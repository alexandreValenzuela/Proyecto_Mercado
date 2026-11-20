import { eq } from "drizzle-orm";
import {
  cartItems,
  carts,
  orderItems,
  orderStatusHistory,
  orders,
  paymentEvents,
  productVariants,
  stockMovements,
} from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import { markManualReview } from "@/lib/checkout/status";
import { fetchMercadoPagoPayment } from "@/lib/mercadopago";

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Procesa una notificación ya verificada por firma. El estado se consulta
 * siempre a la API de MP; el cuerpo del webhook solo aporta el id y el tipo.
 * El evento y todos sus efectos corren en UNA transacción: si falla, se
 * deshace también el registro en `payment_events` y MP puede reintentar.
 */
export async function processPaymentWebhook(input: {
  dataId: string;
  action: string;
  payload: Record<string, unknown>;
}): Promise<WebhookOutcome> {
  const payment = await fetchMercadoPagoPayment(input.dataId);
  const paymentId = payment.id != null ? String(payment.id) : input.dataId;
  const status = payment.status?.toLowerCase() ?? "unknown";
  const statusDetail = payment.status_detail ?? payment.status ?? null;
  const externalReference = payment.external_reference;

  const db = getTransactionalDb();
  return db.transaction(async (tx) => {
    const basePayload: Record<string, unknown> = {
      ...input.payload,
      paymentId,
      status,
      statusDetail,
      externalReference: externalReference ?? null,
    };

    const inserted = await tx
      .insert(paymentEvents)
      .values({
        provider: "mercadopago",
        externalId: input.dataId,
        action: input.action,
        payload: basePayload,
        processedAt: null,
      })
      .onConflictDoNothing({
        target: [paymentEvents.provider, paymentEvents.externalId, paymentEvents.action],
      })
      .returning({ id: paymentEvents.id });

    const eventId = inserted[0]?.id;
    if (!eventId) {
      // Ya registrado: responder 200 sin repetir ningún efecto.
      return "duplicate" as const;
    }

    const finish = async (manualReview: boolean): Promise<void> => {
      await tx
        .update(paymentEvents)
        .set({
          processedAt: new Date(),
          payload: { ...basePayload, manualReview },
        })
        .where(eq(paymentEvents.id, eventId));
    };

    if (!externalReference || !UUID_PATTERN.test(externalReference)) {
      console.warn("webhook: pago sin external_reference válido", paymentId);
      await finish(false);
      return "ignored" as const;
    }

    const order = (
      await tx.select().from(orders).where(eq(orders.id, externalReference)).limit(1).for("update")
    )[0];
    if (!order) {
      console.warn("webhook: no existe el pedido del pago", paymentId, externalReference);
      await finish(false);
      return "ignored" as const;
    }

    if (order.status === "cancelled") {
      await tx
        .update(orders)
        .set({ mpPaymentId: paymentId, mpStatus: statusDetail })
        .where(eq(orders.id, order.id));
      await finish(false);
      return "ignored" as const;
    }

    if (status === "approved") {
      // Un segundo evento de aprobación no debe volver a descontar stock.
      if (order.status !== "pending_payment") {
        await finish(false);
        return "duplicate" as const;
      }

      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const plan: Array<{ variantId: string; quantity: number; deduct: number; stockAtLock: number }> =
        [];
      let manualReview = false;

      for (const item of items) {
        const variant = (
          await tx
            .select({ stock: productVariants.stock })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1)
            .for("update")
        )[0];
        const available = Math.max(0, variant?.stock ?? 0);
        const deduct = Math.min(item.quantity, available);
        if (deduct < item.quantity) {
          manualReview = true;
        }
        plan.push({ variantId: item.variantId, quantity: item.quantity, deduct, stockAtLock: available });
      }

      await tx
        .update(orders)
        .set({
          status: "paid",
          paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
          mpPaymentId: paymentId,
          mpStatus: manualReview ? markManualReview(statusDetail) : statusDetail,
          paymentMethod: payment.payment_method_id ?? payment.payment_type_id ?? null,
        })
        .where(eq(orders.id, order.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "paid",
        changedBy: null,
      });

      for (const entry of plan) {
        if (entry.deduct <= 0) {
          continue;
        }
        await tx
          .update(productVariants)
          .set({ stock: Math.max(0, entry.stockAtLock - entry.deduct) })
          .where(eq(productVariants.id, entry.variantId));
        await tx.insert(stockMovements).values({
          variantId: entry.variantId,
          delta: -entry.deduct,
          reason: "sale",
          orderId: order.id,
          note: manualReview
            ? "Venta aprobada con stock parcial: requiere revisión manual."
            : "Venta aprobada por MercadoPago.",
          createdBy: null,
        });
      }

      // El carrito se vacía recién cuando el pago fue aprobado.
      const cart = (
        await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, order.userId)).limit(1)
      )[0];
      if (cart) {
        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      }

      if (manualReview) {
        console.warn("webhook: stock insuficiente, pedido marcado para revisión manual", order.id);
      }
      await finish(manualReview);
      return "processed" as const;
    }

    // Rechazado, cancelado, expirado, pendiente o cualquier otro estado:
    // el pedido sigue pending_payment para permitir "Reintentar pago".
    await tx
      .update(orders)
      .set({ mpPaymentId: paymentId, mpStatus: statusDetail })
      .where(eq(orders.id, order.id));
    await finish(false);
    console.info("webhook: pago no aprobado, pedido sigue pendiente", order.id, status);
    return "processed" as const;
  });
}
