import { AlertTriangle, ArrowUpRight, CircleDollarSign, Clock3, PackageX, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { KpiCard } from "@/components/admin/analytics/kpi-card";
import { SalesChart } from "@/components/admin/analytics/sales-chart";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminOrders } from "@/db/queries/orders";
import { siteName } from "@/config/site";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatOrderNumber } from "@/lib/checkout/status";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  getDashboardKpis,
  getLast30DaysSales,
  getLowStockVariants,
} from "@/server/analytics/queries";

function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

function variationDetail(percent: number | null): { text: string; tone: "positive" | "negative" | "muted" } {
  if (percent === null) {
    return { text: "Sin ventas en el mes anterior", tone: "muted" };
  }
  return {
    text: `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}% vs. mes anterior`,
    tone: percent >= 0 ? "positive" : "negative",
  };
}

async function DashboardContent() {
  await connection();
  // El proxy es la primera barrera; cada query vuelve a verificar el rol.
  await requireAdmin();

  const [kpis, sales, lowStock, recentOrders] = await Promise.all([
    getDashboardKpis(),
    getLast30DaysSales(),
    getLowStockVariants(),
    listAdminOrders({ status: "all", from: undefined, to: undefined, q: "", page: 1 }, 5),
  ]);
  const variation = variationDetail(kpis.monthVariationPercent);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Ventas de hoy"
          value={formatMoney(kpis.todaySalesCents)}
          detail={`${kpis.todayOrderCount} ${kpis.todayOrderCount === 1 ? "pedido pagado" : "pedidos pagados"}`}
          icon={<CircleDollarSign className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Ventas del mes"
          value={formatMoney(kpis.monthSalesCents)}
          detail={variation.text}
          tone={variation.tone}
          icon={<TrendingUp className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatMoney(kpis.monthAverageTicketCents)}
          detail={`${kpis.monthOrderCount} ${kpis.monthOrderCount === 1 ? "venta" : "ventas"} del mes`}
          icon={<Receipt className="size-4 text-accent" aria-hidden />}
        />
        <KpiCard
          label="Pedidos por atender"
          value={String(kpis.pendingActionOrders)}
          detail="Pagados, en preparación o enviados"
          icon={<Clock3 className="size-4 text-warning" aria-hidden />}
        />
        <KpiCard
          label="Stock bajo"
          value={String(kpis.lowStockVariants)}
          detail="Variantes activas en el umbral"
          icon={<PackageX className="size-4 text-danger" aria-hidden />}
        />
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Ventas de los últimos 30 días</CardTitle>
          <p className="text-xs text-text-muted">
            Pedidos pagados por fecha de pago en hora Argentina; la línea punteada son los 30 días
            anteriores.
          </p>
        </CardHeader>
        <CardContent>
          <SalesChart data={sales} previousLabel="30 días anteriores" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-text">Últimos pedidos</CardTitle>
            <Link href="/admin/pedidos" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Ver todos <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {recentOrders.items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-text-muted">
                Todavía no hay pedidos cargados.
              </p>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentOrders.items.map((order) => (
                    <tr key={order.id} className="hover:bg-primary-soft/30">
                      <td className="px-4 py-3 font-medium text-text">
                        <Link href={`/admin/pedidos/${order.id}`} className="hover:underline">
                          {formatOrderNumber(order.number)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text">{order.customerName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                        {formatMoney(order.totalCents)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Alertas de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">
                Ninguna variante está por debajo de su umbral.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {lowStock.map((row) => (
                  <li key={row.variantId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/productos/${row.productId}`}
                        className="block truncate text-sm font-medium text-text hover:underline"
                      >
                        {row.productName}
                      </Link>
                      <p className="truncate text-xs text-text-muted">
                        {row.variantLabel} · {row.sku}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
                      {row.stock} / {row.threshold}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/admin/productos"
              className={`mt-4 ${buttonVariants({ variant: "outline", size: "sm" })}`}
            >
              Gestionar stock
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Un vistazo de las ventas, los pedidos y el stock de {siteName}.
          </p>
        </div>
        <Link href="/admin/estadisticas" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver estadísticas
        </Link>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
