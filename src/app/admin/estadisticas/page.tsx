import { AlertTriangle, ArrowUpRight, BarChart3, CircleDollarSign, Receipt, UsersRound } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { KpiCard } from "@/components/admin/analytics/kpi-card";
import { SalesChart } from "@/components/admin/analytics/sales-chart";
import { StatusChart } from "@/components/admin/analytics/status-chart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatPeriodDate, resolveAccountingPeriod } from "@/lib/accounting/periods";
import { previousRange } from "@/lib/analytics/periods";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatMoney } from "@/lib/money";
import {
  statsQuerySchema,
  type SalesGranularity,
  type StatsQuery,
} from "@/lib/validators/analytics";
import {
  getCategorySales,
  getCustomerSegments,
  getLowStockVariants,
  getOrdersByStatus,
  getPaymentMethods,
  getProductRankings,
  getRegisteredCustomerCount,
  getSalesComparison,
  type CategorySalesRow,
  type ProductRankingRow,
} from "@/server/analytics/queries";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PERIOD_LABELS: Record<StatsQuery["period"], string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

const GRANULARITY_LABELS: Record<SalesGranularity, string> = {
  day: "Días",
  week: "Semanas",
  month: "Meses",
};

function parseQuery(raw: Record<string, string | string[] | undefined>): StatsQuery {
  const parsed = statsQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : statsQuerySchema.parse({});
}

function StatsSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="px-4 py-10 text-center text-sm text-text-muted">{message}</p>;
}

function IncompleteWarning() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
      <AlertTriangle className="size-3" aria-hidden /> Margen incompleto
    </span>
  );
}

function ProductTable({ rows }: { rows: ProductRankingRow[] }) {
  if (rows.length === 0) {
    return <EmptyMessage message="No hay productos con ventas en el período." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] text-left text-sm">
        <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Ingresos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={row.productId} className="hover:bg-primary-soft/30">
              <td className="px-4 py-3">
                <span className="mr-2 text-xs text-text-muted">{index + 1}.</span>
                <Link href={`/admin/productos/${row.productId}`} className="font-medium text-text hover:underline">
                  {row.name}
                </Link>
                {row.incomplete ? (
                  <span className="mt-1 block">
                    <IncompleteWarning />
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right text-text">{row.units}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                {formatMoney(row.revenueCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({ rows }: { rows: CategorySalesRow[] }) {
  if (rows.length === 0) {
    return <EmptyMessage message="No hay categorías con ventas en el período." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] text-left text-sm">
        <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Margen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.categoryId} className="hover:bg-primary-soft/30">
              <td className="px-4 py-3 text-text">
                {row.name}
                {row.incomplete ? (
                  <span className="mt-1 block">
                    <IncompleteWarning />
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right text-text">{row.units}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                {formatMoney(row.grossMarginCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function StatsContent({ query }: { query: StatsQuery }) {
  await connection();
  // El proxy es la primera barrera; cada query vuelve a verificar el rol.
  await requireAdmin();

  const range = resolveAccountingPeriod({ period: query.period, sort: "date-desc" });
  const previous = previousRange(range);

  const [sales, statuses, rankings, categories, payments, segments, registeredCustomers, lowStock] =
    await Promise.all([
      getSalesComparison(range, query.granularity),
      getOrdersByStatus(range),
      getProductRankings(range),
      getCategorySales(range, 5),
      getPaymentMethods(range),
      getCustomerSegments(range),
      getRegisteredCustomerCount(),
      getLowStockVariants(),
    ]);

  const variation = sales.variationPercent;

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-text-muted">
        {range.label} · comparado con {previous.label}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas del período"
          value={formatMoney(sales.totalCents)}
          detail={range.label}
          icon={<CircleDollarSign className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Variación"
          value={variation === null ? "—" : `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`}
          detail={variation === null ? "Sin base de comparación" : `Vs. ${previous.label}`}
          tone={variation === null ? "muted" : variation >= 0 ? "positive" : "negative"}
          icon={<BarChart3 className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Pedidos pagados"
          value={String(sales.orderCount)}
          detail={`${sales.previousOrderCount} en el período anterior`}
          icon={<Receipt className="size-4 text-accent" aria-hidden />}
        />
        <KpiCard
          label="Ticket promedio"
          value={formatMoney(sales.averageTicketCents)}
          detail={`Anterior: ${formatMoney(sales.previousAverageTicketCents)}`}
          icon={<UsersRound className="size-4 text-primary" aria-hidden />}
        />
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Ventas por {GRANULARITY_LABELS[query.granularity].toLowerCase()}</CardTitle>
          <p className="text-xs text-text-muted">
            Ingresos por pedidos pagados; la serie punteada es el período anterior alineado por tramo.
          </p>
        </CardHeader>
        <CardContent>
          <SalesChart data={sales.points} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Pedidos por estado</CardTitle>
            <p className="text-xs text-text-muted">Pedidos creados en el período, con cualquier estado.</p>
          </CardHeader>
          <CardContent>
            <StatusChart data={statuses} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Métodos de pago utilizados</CardTitle>
            <p className="text-xs text-text-muted">Solo pedidos pagados del período.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {payments.length === 0 ? (
              <EmptyMessage message="No hay métodos de pago registrados en el período." />
            ) : (
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((row) => (
                    <tr key={row.method} className="hover:bg-primary-soft/30">
                      <td className="px-4 py-3 text-text">{row.method}</td>
                      <td className="px-4 py-3 text-right text-text">{row.orderCount}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                        {formatMoney(row.totalCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-text-muted">
                        {formatMoney(Math.round(row.totalCents / row.orderCount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader><CardTitle className="text-text">Productos más vendidos</CardTitle></CardHeader>
          <CardContent className="p-0"><ProductTable rows={rankings.byUnits} /></CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader><CardTitle className="text-text">Productos con más ingresos</CardTitle></CardHeader>
          <CardContent className="p-0"><ProductTable rows={rankings.byRevenue} /></CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader><CardTitle className="text-text">Menor rotación</CardTitle></CardHeader>
          <CardContent className="p-0"><ProductTable rows={rankings.lowestRotation} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader><CardTitle className="text-text">Categorías más vendidas</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryTable rows={categories.byUnits} /></CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader><CardTitle className="text-text">Categorías más rentables</CardTitle></CardHeader>
          <CardContent className="p-0"><CategoryTable rows={categories.byMargin} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Clientes nuevos vs. recurrentes</CardTitle>
            <p className="text-xs text-text-muted">
              {registeredCustomers} clientes registrados. Recurrente ya tenía una compra pagada anterior.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3 text-right">Clientes</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {segments.map((segment) => (
                  <tr key={segment.segment} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3 text-text">{segment.label}</td>
                    <td className="px-4 py-3 text-right text-text">{segment.customerCount}</td>
                    <td className="px-4 py-3 text-right text-text">{segment.orderCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                      {formatMoney(segment.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Stock bajo
            </CardTitle>
            <p className="text-xs text-text-muted">
              Variantes activas con stock menor o igual a su umbral al {formatPeriodDate(range.to)}.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {lowStock.length === 0 ? (
              <EmptyMessage message="Ninguna variante está por debajo de su umbral." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Variante</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Umbral</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lowStock.map((row) => (
                      <tr key={row.variantId} className="hover:bg-primary-soft/30">
                        <td className="px-4 py-3 text-text">
                          <Link href={`/admin/productos/${row.productId}`} className="hover:underline">
                            {row.productName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{row.variantLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-warning">{row.stock}</td>
                        <td className="px-4 py-3 text-right text-text-muted">{row.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function AdminStatisticsPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Estadísticas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Ventas, productos y clientes con datos reales de los pedidos pagados.
          </p>
        </div>
        <Link href="/admin/contabilidad" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver contabilidad <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <form
        method="get"
        action="/admin/estadisticas"
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="stats-period">Período</Label>
          <select
            id="stats-period"
            name="period"
            defaultValue={query.period}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stats-granularity">Agrupar ventas por</Label>
          <select
            id="stats-granularity"
            name="granularity"
            defaultValue={query.granularity}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            {Object.entries(GRANULARITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm">
            Aplicar filtros
          </Button>
        </div>
      </form>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent query={query} />
      </Suspense>
    </main>
  );
}
