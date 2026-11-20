import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/checkout/status";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-warning/15 text-warning",
  paid: "bg-primary-soft text-primary",
  preparing: "bg-primary-soft text-primary",
  shipped: "bg-primary-soft text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const known = status in STATUS_STYLES;
  const label = known
    ? ORDER_STATUS_LABELS[status as OrderStatus]
    : "Estado desconocido";
  const style = known
    ? STATUS_STYLES[status as OrderStatus]
    : "bg-surface-muted text-text-muted";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
