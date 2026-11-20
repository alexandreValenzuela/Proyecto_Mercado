import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { RetryPaymentButton } from "@/components/store/retry-payment-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findOrderForUser, getOrderItems, getOrderStatusHistory } from "@/db/queries/orders";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import {
  formatOrderNumber,
  orderStatusLabel,
  type OrderStatus,
} from "@/lib/checkout/status";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Props = { params: Promise<{ id: string }> };

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

async function OrderDetailContent({ params }: { params: Props["params"] }) {
  await connection();
  const { id } = await params;

  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(`/login?next=${encodeURIComponent(`/cuenta/pedidos/${id}`)}`);
    }
    throw error;
  }

  const order = await findOrderForUser(userId, id);
  if (!order) {
    notFound();
  }

  const [items, history] = await Promise.all([getOrderItems(order.id), getOrderStatusHistory(order.id)]);
  const address = order.shippingAddress;
  const hasDeliveryAddress = order.shippingMethod === "delivery" && Boolean(address?.street);

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-bold text-text">
              Pedido {formatOrderNumber(order.number)}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Realizado el {formatDateTime(order.createdAt)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="border-0 bg-transparent p-0">Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-text">{item.productName}</p>
                  <p className="text-text-muted">
                    {item.variantLabel} · {item.quantity} × {formatMoney(item.unitPriceCents)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-text">
                  {formatMoney(item.unitPriceCents * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Envío</span>
              <span>
                {order.shippingCostCents === 0 ? "Gratis" : formatMoney(order.shippingCostCents)}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-semibold text-text">Total</span>
              <span className="font-heading text-xl font-extrabold text-primary">
                {formatMoney(order.totalCents)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="border-0 bg-transparent p-0">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-muted">
            <p className="font-medium text-text">
              {order.shippingMethod === "delivery" ? "Envío a domicilio" : "Retiro en persona"}
            </p>
            {hasDeliveryAddress ? (
              <>
                <p>{address.recipient_name}</p>
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
              <p>Retirás tu pedido en el local. Te vamos a avisar cuando esté listo.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="border-0 bg-transparent p-0">Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-muted">
            <div className="flex justify-between gap-3">
              <span>Estado</span>
              <span className="text-text">{orderStatusLabel(order.status)}</span>
            </div>
            {order.paymentMethod ? (
              <div className="flex justify-between gap-3">
                <span>Medio de pago</span>
                <span className="text-text">{order.paymentMethod}</span>
              </div>
            ) : null}
            {order.paidAt ? (
              <div className="flex justify-between gap-3">
                <span>Aprobado el</span>
                <span className="text-text">{formatDateTime(order.paidAt)}</span>
              </div>
            ) : null}
            {order.mpStatus?.startsWith("MANUAL_REVIEW:") ? (
              <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                El pago se aprobó pero faltó stock para descontar. Revisión manual pendiente.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="border-0 bg-transparent p-0">Historial del pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-3 text-sm">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <div>
                  <p className="font-medium text-text">
                    {orderStatusLabel(entry.toStatus as OrderStatus)}
                  </p>
                  <p className="text-text-muted">{formatDateTime(entry.createdAt)}</p>
                </div>
              </li>
            ))}
            {history.length === 0 ? (
              <li className="text-sm text-text-muted">Todavía no hay movimientos registrados.</li>
            ) : null}
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link href="/cuenta/pedidos" className={buttonVariants({ variant: "outline" })}>
          Volver a mis pedidos
        </Link>
        {order.status === "pending_payment" ? <RetryPaymentButton orderId={order.id} /> : null}
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">
          Detalle del pedido
        </h1>
        <p className="mt-2 text-text-muted">Toda la información de tu compra en un solo lugar.</p>
      </div>
      <Suspense fallback={<DetailSkeleton />}>
        <OrderDetailContent params={params} />
      </Suspense>
    </main>
  );
}
