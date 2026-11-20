import type { z } from "zod";
import { orderStatusEnum } from "@/db/schema";
import { checkoutResultStatusSchema } from "@/lib/validators/checkout";

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function orderStatusLabel(status: string): string {
  return status in ORDER_STATUS_LABELS
    ? ORDER_STATUS_LABELS[status as OrderStatus]
    : "Estado desconocido";
}

/**
 * No hay una columna dedicada a "revisión manual" en el esquema actual y no se
 * agregó una migración. Convención acordada: `orders.mp_status` lleva este
 * prefijo cuando el pago se aprobó pero no hubo stock suficiente para descontar.
 * El panel admin debe mostrar `mp_status` tal cual para detectar estos pedidos.
 */
export const MANUAL_REVIEW_PREFIX = "MANUAL_REVIEW:";

export function markManualReview(mpStatus: string | null | undefined): string {
  return `${MANUAL_REVIEW_PREFIX}${mpStatus ?? "stock insuficiente"}`;
}

export function hasManualReview(mpStatus: string | null | undefined): boolean {
  return Boolean(mpStatus?.startsWith(MANUAL_REVIEW_PREFIX));
}

export type CheckoutReturnStatus = z.infer<typeof checkoutResultStatusSchema>;

export const CHECKOUT_RETURN_MESSAGES: Record<
  CheckoutReturnStatus,
  { title: string; description: string }
> = {
  approved: {
    title: "¡Pago aprobado!",
    description: "MercadoPago aprobó el pago. Estamos confirmando el pedido.",
  },
  pending: {
    title: "Pago pendiente",
    description: "La operación sigue en proceso. Te avisamos cuando se confirme.",
  },
  failure: {
    title: "No se pudo completar el pago",
    description: "La operación fue rechazada o cancelada. Podés intentar de nuevo.",
  },
};

export function parseCheckoutReturnStatus(value: string | undefined): CheckoutReturnStatus | null {
  const parsed = checkoutResultStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Estado informativo deducido del pedido cuando la URL no trae `status`. */
export function checkStatusFromOrder(status: string | undefined): CheckoutReturnStatus | null {
  if (status === "pending_payment") {
    return "pending";
  }
  if (status === "cancelled") {
    return "failure";
  }
  if (status === "paid" || status === "preparing" || status === "shipped" || status === "delivered") {
    return "approved";
  }
  return null;
}

export function formatOrderNumber(number: number): string {
  return `#${String(number).padStart(4, "0")}`;
}
