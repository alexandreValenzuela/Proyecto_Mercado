"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  orderItems,
  orderStatusHistory,
  orders,
  productVariants,
  stockMovements,
} from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import {
  canCancelOrder,
  canTransition,
  cancellationErrorMessage,
  STOCK_DEDUCTED_ORDER_STATUSES,
  statusLabel,
  transitionErrorMessage,
} from "@/lib/admin/orders";
import { AuthorizationError, requireAdmin } from "@/lib/auth/helpers";
import { formatOrderNumber } from "@/lib/checkout/status";
import {
  cancelOrderSchema,
  changeOrderStatusSchema,
} from "@/lib/validators/admin-orders";

export type AdminOrderActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function failure(message: string): AdminOrderActionResult {
  return { ok: false, message };
}

function success(message: string): AdminOrderActionResult {
  return { ok: true, message };
}

async function requireAdminId(): Promise<string | null> {
  try {
    return (await requireAdmin()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null;
    }
    throw error;
  }
}

function revalidateOrder(orderId: string): void {
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/cuenta/pedidos");
  revalidatePath(`/cuenta/pedidos/${orderId}`);
}

/** Avanza el pedido un paso del recorrido válido, con historial en la misma transacción. */
export async function changeOrderStatusAction(input: unknown): Promise<AdminOrderActionResult> {
  const adminId = await requireAdminId();
  if (!adminId) {
    return failure("No tenés permisos para cambiar el estado del pedido.");
  }

  const parsed = changeOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return failure("La transición elegida no es válida.");
  }

  const { orderId, toStatus } = parsed.data;

  try {
    const result = await getTransactionalDb().transaction(async (tx) => {
      const order = (
        await tx
          .select({ id: orders.id, number: orders.number, status: orders.status })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1)
          .for("update")
      )[0];

      if (!order) {
        return failure("No se encontró el pedido.");
      }
      if (!canTransition(order.status, toStatus)) {
        return failure(transitionErrorMessage(order.status, toStatus));
      }

      await tx
        .update(orders)
        .set({ status: toStatus })
        .where(eq(orders.id, order.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        changedBy: adminId,
      });

      return success(
        `Pedido ${formatOrderNumber(order.number)} actualizado a ${statusLabel(toStatus)}.`,
      );
    });

    if (result.ok) {
      revalidateOrder(orderId);
    }
    return result;
  } catch (error) {
    console.error("admin: error cambiando el estado del pedido", orderId, error);
    return failure("No se pudo actualizar el estado. Intentá de nuevo.");
  }
}

/**
 * Cancela el pedido. Si el pago aprobado había descontado stock, lo devuelve con
 * movimientos `cancellation` en la MISMA transacción. El bloqueo del pedido y la
 * guarda de movimientos previos hacen la operación idempotente.
 */
export async function cancelOrderAction(input: unknown): Promise<AdminOrderActionResult> {
  const adminId = await requireAdminId();
  if (!adminId) {
    return failure("No tenés permisos para cancelar el pedido.");
  }

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return failure("No se encontró el pedido.");
  }

  const { orderId } = parsed.data;

  try {
    const result = await getTransactionalDb().transaction(async (tx) => {
      const order = (
        await tx
          .select({ id: orders.id, number: orders.number, status: orders.status })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1)
          .for("update")
      )[0];

      if (!order) {
        return failure("No se encontró el pedido.");
      }
      if (order.status === "cancelled") {
        return failure("Este pedido ya está cancelado.");
      }
      if (!canCancelOrder(order.status)) {
        return failure(cancellationErrorMessage(order.status));
      }

      const items = await tx
        .select({
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      const sales = await tx
        .select({
          variantId: stockMovements.variantId,
          delta: stockMovements.delta,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.orderId, order.id),
            eq(stockMovements.reason, "sale"),
          ),
        );

      const previousReturns = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.orderId, order.id),
            eq(stockMovements.reason, "cancellation"),
          ),
        )
        .limit(1);

      // Los movimientos de venta son la fuente exacta: cubren descuentos
      // parciales por stock insuficiente. Si no existen (pedidos demo o
      // anteriores al webhook), se usa la cantidad de cada ítem.
      const returns = new Map<string, number>();
      if (sales.length > 0) {
        for (const movement of sales) {
          const quantity = Math.max(0, -movement.delta);
          if (quantity > 0) {
            returns.set(
              movement.variantId,
              (returns.get(movement.variantId) ?? 0) + quantity,
            );
          }
        }
      } else if (STOCK_DEDUCTED_ORDER_STATUSES.includes(order.status)) {
        for (const item of items) {
          returns.set(item.variantId, (returns.get(item.variantId) ?? 0) + item.quantity);
        }
      }

      if (previousReturns.length === 0) {
        const entries = [...returns.entries()].sort(([a], [b]) => a.localeCompare(b));
        for (const [variantId, quantity] of entries) {
          const variant = (
            await tx
              .select({ sku: productVariants.sku, stock: productVariants.stock })
              .from(productVariants)
              .where(eq(productVariants.id, variantId))
              .limit(1)
              .for("update")
          )[0];
          if (!variant) {
            throw new Error(`No existe la variante ${variantId} del pedido ${order.id}.`);
          }

          await tx
            .update(productVariants)
            .set({ stock: variant.stock + quantity })
            .where(eq(productVariants.id, variantId));
          await tx.insert(stockMovements).values({
            variantId,
            delta: quantity,
            reason: "cancellation",
            orderId: order.id,
            note: `Devolución por cancelación del pedido ${formatOrderNumber(order.number)}.`,
            createdBy: adminId,
          });
        }
      }

      await tx
        .update(orders)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(orders.id, order.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "cancelled",
        changedBy: adminId,
      });

      return success(`Pedido ${formatOrderNumber(order.number)} cancelado.`);
    });

    if (result.ok) {
      revalidateOrder(orderId);
    }
    return result;
  } catch (error) {
    console.error("admin: error cancelando el pedido", orderId, error);
    return failure("No se pudo cancelar el pedido. Intentá de nuevo.");
  }
}
