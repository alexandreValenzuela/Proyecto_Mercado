import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  addresses,
  cartItems,
  carts,
  orderItems,
  orderStatusHistory,
  orders,
  productVariants,
  products,
  storeSettings,
  users,
  type ShippingAddressSnapshot,
} from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import { findOrderById, getOrderItems, getOrderPayerEmail } from "@/db/queries/orders";
import { createCheckoutPreference } from "@/lib/mercadopago";
import type { CreateCheckoutInput } from "@/lib/validators/checkout";
import type { AddressInput } from "@/lib/validators/address";

export type CreateOrderOutcome =
  | { ok: true; orderId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function addressSnapshot(input: {
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  floorApt: string | null;
  city: string;
  province: AddressInput["province"] | "";
  postalCode: string;
  notes: string | null;
}): ShippingAddressSnapshot {
  return {
    recipient_name: input.recipientName,
    phone: input.phone,
    street: input.street,
    number: input.number,
    floor_apt: input.floorApt,
    city: input.city,
    province: input.province,
    postal_code: input.postalCode,
    notes: input.notes,
  };
}

/**
 * Toda la creación del pedido (configuración, carrito, stock, dirección,
 * snapshots e historial) ocurre en UNA transacción. Ningún importe viaja desde
 * el cliente: se recalculan desde la base de datos.
 */
export async function createPendingOrder(
  userId: string,
  input: CreateCheckoutInput,
): Promise<CreateOrderOutcome> {
  const db = getTransactionalDb();

  return db.transaction(async (tx) => {
    const settings = (await tx.select().from(storeSettings).limit(1))[0];
    if (!settings) {
      return { ok: false, message: "Falta la configuración de la tienda. Avisá al administrador." };
    }
    if (input.shippingMethod === "delivery" && !settings.deliveryEnabled) {
      return { ok: false, message: "El envío a domicilio no está disponible en este momento." };
    }
    if (input.shippingMethod === "pickup" && !settings.pickupEnabled) {
      return { ok: false, message: "El retiro en persona no está disponible en este momento." };
    }

    const cart = (
      await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1).for("update")
    )[0];
    if (!cart) {
      return { ok: false, message: "Tu carrito está vacío. Agregá productos antes de pagar." };
    }

    const rows = await tx
      .select({
        itemId: cartItems.id,
        quantity: cartItems.quantity,
        variantId: productVariants.id,
        variantLabel: productVariants.label,
        sku: productVariants.sku,
        variantActive: productVariants.active,
        variantPriceCents: productVariants.priceCents,
        variantCostCents: productVariants.costCents,
        productId: products.id,
        productName: products.name,
        productActive: products.active,
        basePriceCents: products.basePriceCents,
        productCostCents: products.costCents,
      })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(cartItems.cartId, cart.id));

    if (rows.length === 0) {
      return { ok: false, message: "Tu carrito está vacío. Agregá productos antes de pagar." };
    }

    let subtotalCents = 0;
    const snapshots: Array<{
      variantId: string;
      productName: string;
      variantLabel: string;
      unitPriceCents: number;
      unitCostCents: number | null;
      quantity: number;
    }> = [];

    for (const row of rows) {
      const locked = (
        await tx
          .select({ stock: productVariants.stock })
          .from(productVariants)
          .where(eq(productVariants.id, row.variantId))
          .limit(1)
          .for("update")
      )[0];
      const available = locked?.stock ?? 0;

      if (!row.variantActive || !row.productActive) {
        return {
          ok: false,
          message: `“${row.productName}” ya no está disponible. Sacalo del carrito para seguir.`,
        };
      }
      if (available < row.quantity) {
        return {
          ok: false,
          message: `Solo quedan ${available} unidades de “${row.productName}”. Ajustá la cantidad en el carrito.`,
        };
      }

      const unitPriceCents = row.variantPriceCents ?? row.basePriceCents;
      const unitCostCents = row.variantCostCents ?? row.productCostCents;
      subtotalCents += unitPriceCents * row.quantity;
      snapshots.push({
        variantId: row.variantId,
        productName: row.productName,
        variantLabel: row.variantLabel,
        unitPriceCents,
        unitCostCents,
        quantity: row.quantity,
      });
    }

    let snapshot: ShippingAddressSnapshot;
    if (input.shippingMethod === "delivery") {
      let address;
      if (input.newAddress) {
        const count = await tx
          .select({ id: addresses.id })
          .from(addresses)
          .where(eq(addresses.userId, userId));
        const isDefault = input.newAddress.isDefault || count.length === 0;
        if (isDefault) {
          await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
        }
        address = (
          await tx
            .insert(addresses)
            .values({
              userId,
              recipientName: input.newAddress.recipientName,
              phone: input.newAddress.phone,
              street: input.newAddress.street,
              number: input.newAddress.number,
              floorApt: input.newAddress.floorApt ?? null,
              city: input.newAddress.city,
              province: input.newAddress.province,
              postalCode: input.newAddress.postalCode,
              notes: input.newAddress.notes ?? null,
              isDefault,
            })
            .returning()
        )[0];
      } else if (input.addressId) {
        address = (
          await tx
            .select()
            .from(addresses)
            .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)))
            .limit(1)
        )[0];
      }

      if (!address) {
        return {
          ok: false,
          message: "No encontramos la dirección elegida. Seleccioná otra o cargá una nueva.",
          fieldErrors: { addressId: "Elegí una dirección válida." },
        };
      }

      snapshot = addressSnapshot({
        recipientName: address.recipientName,
        phone: address.phone,
        street: address.street,
        number: address.number,
        floorApt: address.floorApt,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        notes: address.notes,
      });
    } else {
      const user = (
        await tx.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1)
      )[0];
      snapshot = addressSnapshot({
        recipientName: user?.name ?? "Cliente",
        phone: user?.phone ?? "",
        street: "",
        number: "",
        floorApt: null,
        city: "",
        province: "",
        postalCode: "",
        notes: `Retiro en persona. ${settings.pickupInstructions ?? ""}`.trim(),
      });
    }

    let shippingCostCents = 0;
    if (input.shippingMethod === "delivery") {
      const threshold = settings.freeShippingThresholdCents;
      shippingCostCents =
        threshold != null && subtotalCents >= threshold ? 0 : settings.shippingFlatCents;
    }

    const created = await tx
      .insert(orders)
      .values({
        userId,
        status: "pending_payment",
        subtotalCents,
        shippingCostCents,
        totalCents: subtotalCents + shippingCostCents,
        shippingMethod: input.shippingMethod,
        shippingAddress: snapshot,
      })
      .returning({ id: orders.id });
    const orderId = created[0].id;

    await tx.insert(orderItems).values(
      snapshots.map((item) => ({
        orderId,
        variantId: item.variantId,
        productName: item.productName,
        variantLabel: item.variantLabel,
        unitPriceCents: item.unitPriceCents,
        unitCostCents: item.unitCostCents,
        quantity: item.quantity,
      })),
    );
    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: null,
      toStatus: "pending_payment",
      changedBy: userId,
    });

    return { ok: true, orderId };
  });
}

async function attachPreference(orderId: string, preferenceId: string | null): Promise<void> {
  if (!preferenceId) {
    return;
  }
  await getDb().update(orders).set({ mpPreferenceId: preferenceId }).where(eq(orders.id, orderId));
}

/**
 * Crea una preferencia nueva sobre un pedido existente. La usan tanto el alta
 * del checkout como "Reintentar pago": nunca se crea un pedido duplicado.
 */
export async function createPreferenceForOrder(orderId: string): Promise<string> {
  const order = await findOrderById(orderId);
  if (!order) {
    throw new Error("No encontramos el pedido. Volvé al carrito e intentá de nuevo.");
  }
  if (order.status !== "pending_payment") {
    throw new Error("Este pedido ya no admite pagos. Revisá el estado en Mis pedidos.");
  }

  const items = await getOrderItems(orderId);
  if (items.length === 0) {
    throw new Error("El pedido no tiene productos. Volvé al carrito e intentá de nuevo.");
  }

  const lines = items.map((item) => ({
    id: item.variantId,
    title: `${item.productName} · ${item.variantLabel}`,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
  if (order.shippingCostCents > 0) {
    lines.push({
      id: "shipping",
      title: "Envío a domicilio",
      quantity: 1,
      unitPriceCents: order.shippingCostCents,
    });
  }

  const preference = await createCheckoutPreference({
    orderId,
    lines,
    payerEmail: await getOrderPayerEmail(orderId),
  });
  await attachPreference(orderId, preference.preferenceId);
  return preference.checkoutUrl;
}

/** Mensaje amigable para errores de MP sin filtrar detalles técnicos. */
export function checkoutErrorMessage(error: unknown, orderId: string | null): string {
  if (error instanceof Error) {
    if (
      error.message.includes("MP_ACCESS_TOKEN") ||
      error.message.includes("APP_URL") ||
      error.message.includes("MercadoPago no devolvió")
    ) {
      return error.message;
    }
  }
  console.error("checkout", error);
  return orderId
    ? `El pedido se creó, pero no se pudo generar el pago. Podés reintentarlo desde Mis pedidos.`
    : "No se pudo iniciar el pago. Intentá de nuevo.";
}
