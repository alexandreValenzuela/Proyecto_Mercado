import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { RetryPaymentButton } from "@/components/store/retry-payment-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findOrderForUser } from "@/db/queries/orders";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import {
  CHECKOUT_RETURN_MESSAGES,
  checkStatusFromOrder,
  formatOrderNumber,
  parseCheckoutReturnStatus,
  type CheckoutReturnStatus,
} from "@/lib/checkout/status";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function oneValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function loginRedirectPath(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = oneValue(value);
    if (single) {
      query.set(key, single);
    }
  }
  const search = query.toString();
  const next = `/checkout/resultado${search ? `?${search}` : ""}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function ResultSkeleton() {
  return <div className="mx-auto h-80 max-w-2xl animate-pulse rounded-2xl bg-surface-muted" />;
}

async function ResultContent({ searchParams }: { searchParams: Props["searchParams"] }) {
  await connection();
  const params = await searchParams;

  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(loginRedirectPath(params));
    }
    throw error;
  }

  const orderId = oneValue(params.order);
  const order = orderId ? await findOrderForUser(userId, orderId) : null;
  const urlStatus = parseCheckoutReturnStatus(oneValue(params.status));

  // La URL es informativa: el estado real lo escribe el webhook en la BD.
  const status: CheckoutReturnStatus = urlStatus ?? checkStatusFromOrder(order?.status) ?? "pending";
  const message = CHECKOUT_RETURN_MESSAGES[status];
  const canRetry = Boolean(order && order.status === "pending_payment" && status !== "approved");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-border bg-surface text-center shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <p className="font-heading text-2xl font-extrabold text-text sm:text-3xl">
            {message.title}
          </p>
          <p className="max-w-md text-text-muted">{message.description}</p>
          <p className="mt-2 rounded-xl bg-primary-soft px-4 py-2 text-xs text-primary">
            El estado definitivo lo confirma MercadoPago con el webhook. Si el pago se aprobó, el
            stock se descuenta automáticamente y vas a ver el pedido confirmado en Mis pedidos.
          </p>
        </CardContent>
      </Card>

      {order ? (
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 border-0 bg-transparent p-0">
              <span>Pedido {formatOrderNumber(order.number)}</span>
              <OrderStatusBadge status={order.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 text-text-muted">
              <span>Fecha</span>
              <span className="text-text">{formatDateTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-3 text-text-muted">
              <span>Entrega</span>
              <span className="text-text">
                {order.shippingMethod === "delivery" ? "Envío a domicilio" : "Retiro en persona"}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-3">
              <span className="font-semibold text-text">Total</span>
              <span className="font-heading text-lg font-extrabold text-primary">
                {formatMoney(order.totalCents)}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface">
          <CardContent className="py-8 text-center text-sm text-text-muted">
            No encontramos el pedido asociado a este pago. Revisá tu historial en Mis pedidos.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {canRetry && order ? <RetryPaymentButton orderId={order.id} /> : null}
        <Link href="/cuenta/pedidos" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ver mis pedidos
        </Link>
        <Link href="/catalogo" className={buttonVariants({ variant: "link", size: "lg" })}>
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutResultPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
      <Suspense fallback={<ResultSkeleton />}>
        <ResultContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
