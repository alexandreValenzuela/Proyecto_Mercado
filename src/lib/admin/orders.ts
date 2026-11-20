import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/checkout/status";

/**
 * Recorrido válido del pedido. `pending_payment` solo avanza cuando el webhook
 * confirma el pago; el panel admin no puede marcar un pedido como pagado a mano.
 * `delivered` y `cancelled` son estados terminales.
 */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: [],
  paid: ["preparing"],
  preparing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Se puede cancelar antes de entregar; después de entregar, no. */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
];

/** Estados en los que el pago aprobado ya descontó stock. */
export const STOCK_DEDUCTED_ORDER_STATUSES: readonly OrderStatus[] = [
  "paid",
  "preparing",
  "shipped",
];

export function orderStatusFrom(value: string): OrderStatus | null {
  return value in ORDER_STATUS_LABELS ? (value as OrderStatus) : null;
}

export function allowedNextStatuses(status: string): OrderStatus[] {
  const current = orderStatusFrom(status);
  return current ? [...ADMIN_ORDER_TRANSITIONS[current]] : [];
}

export function canTransition(from: string, to: string): boolean {
  return allowedNextStatuses(from).includes(to as OrderStatus);
}

export function canCancelOrder(status: string): boolean {
  const current = orderStatusFrom(status);
  return current ? CANCELLABLE_ORDER_STATUSES.includes(current) : false;
}

export function transitionErrorMessage(from: string, to: string): string {
  const fromLabel = ORDER_STATUS_LABELS[from as OrderStatus] ?? "desconocido";
  const toLabel = ORDER_STATUS_LABELS[to as OrderStatus] ?? "desconocido";
  const next = allowedNextStatuses(from);
  if (next.length === 0) {
    return `El pedido está ${fromLabel} y no tiene transiciones posteriores.`;
  }
  const options = next.map((status) => ORDER_STATUS_LABELS[status]).join(" o ");
  return `No se puede pasar de ${fromLabel} a ${toLabel}. El siguiente estado válido es ${options}.`;
}

export function cancellationErrorMessage(status: string): string {
  const label = ORDER_STATUS_LABELS[status as OrderStatus] ?? "desconocido";
  return `No se puede cancelar un pedido ${label}.`;
}

export function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? "Estado desconocido";
}
