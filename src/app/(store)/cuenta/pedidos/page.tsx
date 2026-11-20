import { PackageOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { RetryPaymentButton } from "@/components/store/retry-payment-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listOrdersForUser } from "@/db/queries/orders";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import { formatOrderNumber } from "@/lib/checkout/status";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}

async function OrdersContent() {
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login?next=/cuenta/pedidos");
    }
    throw error;
  }

  const orders = await listOrdersForUser(userId);

  if (orders.length === 0) {
    return (
      <Card className="border-border bg-surface">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <PackageOpen className="size-7" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-xl font-bold text-text">Todavía no hiciste pedidos</p>
            <p className="mt-1 text-sm text-text-muted">
              Cuando compres, vas a poder seguir el estado desde acá.
            </p>
          </div>
          <Link href="/catalogo" className={buttonVariants({ size: "lg" })}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Card className="border-border bg-surface shadow-sm">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-heading text-lg font-bold text-text">
                    Pedido {formatOrderNumber(order.number)}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-sm text-text-muted">
                  {formatDate(order.createdAt)} ·{" "}
                  {order.shippingMethod === "delivery" ? "Envío a domicilio" : "Retiro en persona"}
                </p>
                <p className="font-semibold text-text">{formatMoney(order.totalCents)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/cuenta/pedidos/${order.id}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Ver detalle
                </Link>
                {order.status === "pending_payment" ? (
                  <RetryPaymentButton orderId={order.id} />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Mis pedidos</h1>
        <p className="mt-2 text-text-muted">Revisá el estado y el detalle de tus compras.</p>
      </div>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersContent />
      </Suspense>
    </main>
  );
}
