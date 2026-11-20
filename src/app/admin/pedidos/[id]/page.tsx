import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AdminOrderActions } from "@/components/admin/admin-order-actions";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOrderDetail } from "@/db/queries/orders";
import {
  allowedNextStatuses,
  canCancelOrder,
  statusLabel,
} from "@/lib/admin/orders";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatOrderNumber, hasManualReview } from "@/lib/checkout/status";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Props = { params: Promise<{ id: string }> };

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Venta",
  restock: "Reposición",
  adjustment: "Ajuste",
  cancellation: "Cancelación",
};

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <CardTitle className="border-0 bg-transparent p-0">{children}</CardTitle>;
}

async function OrderDetailContent({ params }: { params: Props["params"] }) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  // El rol se verifica acá y también en la query del panel.
  await requireAdmin();
  const detail = await getAdminOrderDetail(id);
  if (!detail) {
    notFound();
  }

  const { order, items, history, movements } = detail;
  const address = order.shippingAddress;
  const nextStatuses = allowedNextStatuses(order.status);
  const cancellable = canCancelOrder(order.status);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-bold text-text">
              Pedido {formatOrderNumber(order.number)}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Creado el {formatDateTime(order.createdAt)}
              {order.cancelledAt ? ` · Cancelado el ${formatDateTime(order.cancelledAt)}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <OrderStatusBadge status={order.status} />
            <p className="font-heading text-xl font-extrabold text-primary">
              {formatMoney(order.totalCents)}
            </p>
          </div>
        </CardContent>
      </Card>

      {hasManualReview(order.mpStatus) ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-text"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold text-warning">Revisión manual pendiente</p>
            <p className="mt-1">
              El pago se aprobó pero no hubo stock suficiente para descontar la totalidad de los
              ítems. Revisá el pedido antes de seguir el recorrido de preparación.
            </p>
            <p className="mt-1 text-text-muted">Estado informado por MercadoPago: {order.mpStatus}</p>
          </div>
        </div>
      ) : null}

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <SectionTitle>Acciones del pedido</SectionTitle>
        </CardHeader>
        <CardContent>
          <AdminOrderActions
            orderId={order.id}
            status={order.status}
            nextStatuses={nextStatuses}
            canCancel={cancellable}
          />
          <p className="mt-3 text-xs text-text-muted">
            Los cambios se registran en el historial con tu usuario. Cancelar devuelve el stock
            descontado cuando corresponde.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <SectionTitle>Cliente y entrega</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-muted">
            <p className="font-medium text-text">
              {order.customerName} · {order.customerEmail}
            </p>
            <p>
              {order.shippingMethod === "delivery" ? "Envío a domicilio" : "Retiro en persona"}
            </p>
            {order.shippingMethod === "delivery" && address?.street ? (
              <>
                <p>
                  {address.recipient_name} · {address.phone}
                </p>
                <p>
                  {address.street} {address.number}
                  {address.floor_apt ? `, ${address.floor_apt}` : ""}
                </p>
                <p>
                  {address.city}, {address.province} · CP {address.postal_code}
                </p>
                {address.notes ? <p className="text-xs">{address.notes}</p> : null}
              </>
            ) : (
              <p>El cliente retira el pedido en el local.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <SectionTitle>Pago</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-muted">
            <div className="flex justify-between gap-3">
              <span>Estado del pedido</span>
              <span className="text-text">{statusLabel(order.status)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Medio de pago</span>
              <span className="text-right text-text">{order.paymentMethod ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Estado de MercadoPago</span>
              <span className="max-w-[60%] break-words text-right text-text">
                {order.mpStatus ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>ID de pago</span>
              <span className="break-all text-right text-text">{order.mpPaymentId ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Aprobado el</span>
              <span className="text-text">{order.paidAt ? formatDateTime(order.paidAt) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <SectionTitle>Ítems del pedido</SectionTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Variante</th>
                <th className="px-3 py-2">Cantidad</th>
                <th className="px-3 py-2">Precio unitario</th>
                <th className="px-3 py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-text">{item.productName}</td>
                  <td className="px-3 py-2 text-text-muted">{item.variantLabel}</td>
                  <td className="px-3 py-2 text-text">{item.quantity}</td>
                  <td className="px-3 py-2 text-text">{formatMoney(item.unitPriceCents)}</td>
                  <td className="px-3 py-2 text-text">
                    {formatMoney(item.unitPriceCents * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Envío</span>
              <span>
                {order.shippingCostCents === 0
                  ? "Gratis"
                  : formatMoney(order.shippingCostCents)}
              </span>
            </div>
            <div className="flex justify-between pt-1 font-semibold text-text">
              <span>Total</span>
              <span>{formatMoney(order.totalCents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <SectionTitle>Historial del pedido</SectionTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-text">
                      {entry.fromStatus ? `${statusLabel(entry.fromStatus)} → ` : ""}
                      {statusLabel(entry.toStatus)}
                    </p>
                    <p className="text-text-muted">
                      {formatDateTime(entry.createdAt)} · {entry.changedByName ?? "Sistema"}
                    </p>
                  </div>
                </li>
              ))}
              {history.length === 0 ? (
                <li className="text-sm text-text-muted">No hay movimientos registrados.</li>
              ) : null}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <SectionTitle>Movimientos de stock</SectionTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {movements.length === 0 ? (
              <p className="text-sm text-text-muted">
                No hay movimientos de stock asociados a este pedido.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium text-text">
                        {MOVEMENT_LABELS[movement.reason] ?? movement.reason} ·{" "}
                        {movement.sku ?? "Variante"}
                      </p>
                      <p className="text-xs text-text-muted">{formatDateTime(movement.createdAt)}</p>
                    </div>
                    <span
                      className={`font-semibold ${
                        movement.delta > 0 ? "text-primary" : "text-danger"
                      }`}
                    >
                      {movement.delta > 0 ? "+" : ""}
                      {movement.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Link href="/admin/pedidos" className={buttonVariants({ variant: "outline" })}>
        Volver a pedidos
      </Link>
    </div>
  );
}

export default function AdminOrderDetailPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-text">Detalle del pedido</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ítems, pago, historial y acciones disponibles.
        </p>
      </div>
      <Suspense fallback={<DetailSkeleton />}>
        <OrderDetailContent params={params} />
      </Suspense>
    </main>
  );
}
