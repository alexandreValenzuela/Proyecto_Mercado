import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  MapPin,
  MousePointerClick,
  Repeat2,
  ShoppingCart,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { KpiCard } from "@/components/admin/analytics/kpi-card";
import { MarketBarChart } from "@/components/admin/analytics/market-bar-chart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { siteConfig } from "@/config/site";
import { resolveAccountingPeriod } from "@/lib/accounting/periods";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatMoney } from "@/lib/money";
import { statsQuerySchema, type StatsQuery } from "@/lib/validators/analytics";
import {
  getAbandonedCarts,
  getConversionFunnel,
  getMarketGeography,
  getMarketTiming,
  getRepeatCustomers,
  getViewedVsPurchased,
  type AbandonedCarts,
  type FunnelStep,
  type MarketHeatmapCell,
  type MarketTimeBucketRow,
  type MarketWeekdayRow,
  type RepeatCustomerSummary,
  type ViewedVsPurchasedRow,
} from "@/server/analytics/market";
import {
  buildMarketFindings,
  type MarketFinding,
  type MarketFindingTone,
} from "@/server/analytics/market-findings";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PERIOD_LABELS: Record<StatsQuery["period"], string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

const numberFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function rateText(rate: number | null): string {
  return rate === null ? "—" : `${numberFormat.format(rate)} %`;
}

function parseQuery(raw: Record<string, string | string[] | undefined>): StatsQuery {
  const parsed = statsQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : statsQuerySchema.parse({});
}

function MarketSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
      </div>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="px-4 py-10 text-center text-sm text-text-muted">{message}</p>;
}

function LocationTable({ rows }: { rows: { label: string; orderCount: number; totalCents: number; averageTicketCents: number }[] }) {
  if (rows.length === 0) {
    return <EmptyMessage message="No hay compras pagadas en el período elegido." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3">Ubicación</th>
            <th className="px-4 py-3 text-right">Pedidos</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Ticket</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.label} className="hover:bg-primary-soft/30">
              <td className="px-4 py-3 text-text">{row.label}</td>
              <td className="px-4 py-3 text-right text-text">{numberFormat.format(row.orderCount)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                {formatMoney(row.totalCents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-text-muted">
                {formatMoney(row.averageTicketCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HEATMAP_LEVELS = [
  "bg-surface-muted text-text-muted",
  "bg-primary-soft text-text",
  "bg-primary/40 text-text",
  "bg-primary/70 text-white",
  "bg-primary text-white",
];

function TimingHeatmap({
  weekdays,
  buckets,
  cells,
}: {
  weekdays: MarketWeekdayRow[];
  buckets: MarketTimeBucketRow[];
  cells: MarketHeatmapCell[];
}) {
  const byKey = new Map(cells.map((cell) => [`${cell.isoDay}-${cell.bucket}`, cell.orderCount]));
  const max = Math.max(1, ...cells.map((cell) => cell.orderCount));
  const cellClass = (count: number) => {
    if (count === 0) return HEATMAP_LEVELS[0];
    const level = Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
    return HEATMAP_LEVELS[level];
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[460px]"
        style={{ display: "grid", gridTemplateColumns: `72px repeat(${buckets.length}, minmax(0, 1fr))`, gap: 4 }}
      >
        <span />
        {buckets.map((bucket) => (
          <span key={bucket.bucket} className="text-center text-[10px] text-text-muted">
            {bucket.label.replace(" h", "")}
          </span>
        ))}
        {weekdays.flatMap((day) => [
          <span key={`day-${day.isoDay}`} className="self-center text-xs text-text-muted">
            {day.label}
          </span>,
          ...buckets.map((bucket) => {
            const count = byKey.get(`${day.isoDay}-${bucket.bucket}`) ?? 0;
            return (
              <span
                key={`${day.isoDay}-${bucket.bucket}`}
                title={`${day.label}, ${bucket.label}: ${count} pedidos`}
                className={`flex h-7 items-center justify-center rounded-md text-[11px] font-semibold ${cellClass(
                  count,
                )}`}
              >
                {count === 0 ? "·" : count}
              </span>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function FunnelSection({ steps }: { steps: FunnelStep[] }) {
  if (steps[0]?.count === 0) {
    return <EmptyMessage message="Todavía no se registraron visitas a productos en el período." />;
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.id} className="rounded-xl border border-border bg-surface-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-text">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                {index + 1}
              </span>
              {step.label}
            </span>
            <span className="font-heading text-lg font-bold text-text">{numberFormat.format(step.count)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
            <span>Desde el paso anterior: {rateText(step.rateFromPrevious)}</span>
            <span>Desde las visitas: {rateText(step.rateFromStart)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function AbandonedSection({ abandoned }: { abandoned: AbandonedCarts }) {
  if (abandoned.count === 0) {
    return (
      <EmptyMessage message="No hay carritos con ítems inactivos desde hace más de un día." />
    );
  }

  return (
    <div className="space-y-3">
      <p className="px-4 text-xs text-text-muted">
        Valor estimado: <strong className="text-text">{formatMoney(abandoned.estimatedValueCents)}</strong> con precios
        actuales, sin contar envío. Se muestran los carritos más antiguos.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Última actividad</th>
              <th className="px-4 py-3 text-right">Ítems</th>
              <th className="px-4 py-3 text-right">Estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {abandoned.rows.slice(0, 8).map((cart) => (
              <tr key={cart.cartId} className="hover:bg-primary-soft/30">
                <td className="px-4 py-3 text-text">
                  {cart.owner}
                  {cart.isDemo ? <span className="ml-2 text-xs text-text-muted">(demo)</span> : null}
                </td>
                <td className="px-4 py-3 text-text-muted">{cart.lastActivity}</td>
                <td className="px-4 py-3 text-right text-text">{cart.itemCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                  {formatMoney(cart.estimatedValueCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewedVsPurchasedSection({ rows }: { rows: ViewedVsPurchasedRow[] }) {
  if (rows.length === 0) {
    return <EmptyMessage message="No hay visitas a productos en el período elegido." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3 text-right">Visitas</th>
            <th className="px-4 py-3 text-right">Compras</th>
            <th className="px-4 py-3 text-right">Unidades</th>
            <th className="px-4 py-3 text-right">Conversión</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.productId} className="hover:bg-primary-soft/30">
              <td className="px-4 py-3 text-text">
                <Link href={`/admin/productos/${row.productId}`} className="hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-right text-text">{row.views}</td>
              <td className="px-4 py-3 text-right text-text">{row.purchaseCount}</td>
              <td className="px-4 py-3 text-right text-text">{row.units}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                {rateText(row.conversionPercent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepeatSection({ repeat }: { repeat: RepeatCustomerSummary }) {
  if (repeat.totalCustomers === 0) {
    return <EmptyMessage message="Todavía no hay clientes con pedidos pagados hasta el final del período." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-muted/60 p-3">
          <p className="text-xs text-text-muted">Compras por cliente</p>
          <p className="font-heading text-xl font-bold text-text">{numberFormat.format(repeat.averageOrdersPerCustomer)}</p>
        </div>
        <div className="rounded-xl bg-surface-muted/60 p-3">
          <p className="text-xs text-text-muted">Valor por cliente</p>
          <p className="font-heading text-xl font-bold text-text">
            {formatMoney(repeat.averageValueCentsPerCustomer)}
          </p>
        </div>
        <div className="rounded-xl bg-surface-muted/60 p-3">
          <p className="text-xs text-text-muted">Recompra</p>
          <p className="font-heading text-xl font-bold text-text">{rateText(repeat.repeatRatePercent)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[380px] text-left text-sm">
          <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3 text-right">Clientes</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {repeat.segments.map((segment) => (
              <tr key={segment.label} className="hover:bg-primary-soft/30">
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
      </div>
      <p className="px-4 text-xs text-text-muted">
        Definición: es recurrente quien tiene dos o más pedidos pagados hasta el final del período, sin importar cuándo
        los hizo. “Nuevo” significa una sola compra en ese corte, no necesariamente la primera del período.
      </p>
    </div>
  );
}

const FINDING_DOTS: Record<MarketFindingTone, string> = {
  info: "bg-primary",
  good: "bg-primary",
  attention: "bg-warning",
};

function FindingsSection({ findings }: { findings: MarketFinding[] }) {
  if (findings.length === 0) {
    return <EmptyMessage message="Todavía no hay datos suficientes para generar hallazgos." />;
  }

  return (
    <ul className="space-y-3">
      {findings.map((finding) => (
        <li key={finding.id} className="flex gap-3 rounded-xl border border-border bg-surface-muted/40 p-3">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${FINDING_DOTS[finding.tone]}`} aria-hidden />
          <div>
            <p className="text-sm font-medium text-text">{finding.message}</p>
            <p className="mt-1 text-xs text-text-muted">{finding.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function MarketContent({ query }: { query: StatsQuery }) {
  await connection();
  // El proxy es la primera barrera; el límite de la página vuelve a chequear el rol.
  await requireAdmin();

  const range = resolveAccountingPeriod({ period: query.period, sort: "date-desc" });
  const [geography, timing, funnel, abandoned, viewedVsPurchased, repeat] = await Promise.all([
    getMarketGeography(range),
    getMarketTiming(range),
    getConversionFunnel(range),
    getAbandonedCarts(new Date()),
    getViewedVsPurchased(range),
    getRepeatCustomers(range),
  ]);

  const findings = buildMarketFindings({
    rangeLabel: range.label,
    provinces: geography.provinces,
    pickup: geography.pickup,
    weekdays: timing.weekdays,
    buckets: timing.buckets,
    funnel,
    abandoned: {
      count: abandoned.count,
      estimatedValueCents: abandoned.estimatedValueCents,
      olderThanHours: abandoned.olderThanHours,
    },
    viewedVsPurchased,
    repeat,
  });

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-text-muted">
        {range.label} · agrupado en hora de Argentina · ingresos de pedidos pagados
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Vistas de producto"
          value={numberFormat.format(funnel.views)}
          detail="Visitas registradas en el período"
          icon={<MousePointerClick className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Carritos con ítems"
          value={numberFormat.format(funnel.carts)}
          detail="Creados en el período"
          icon={<ShoppingCart className="size-4 text-accent" aria-hidden />}
        />
        <KpiCard
          label="Pedidos pagados"
          value={numberFormat.format(funnel.paidOrders)}
          detail={`${funnel.createdOrders} pedidos creados`}
          icon={<UsersRound className="size-4 text-primary" aria-hidden />}
        />
        <KpiCard
          label="Conversión global"
          value={rateText(funnel.steps[funnel.steps.length - 1]?.rateFromStart ?? null)}
          detail="Pedidos pagados sobre vistas"
          icon={<Repeat2 className="size-4 text-primary" aria-hidden />}
          tone={funnel.views === 0 ? "muted" : "default"}
        />
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-text">
            <Sparkles className="size-4 text-accent" aria-hidden /> Mirá estos hallazgos
          </CardTitle>
          <p className="text-xs text-text-muted">Reglas fijas sobre los datos del período; sin estimaciones inventadas.</p>
        </CardHeader>
        <CardContent>
          <FindingsSection findings={findings} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Compras por provincia</CardTitle>
            <p className="text-xs text-text-muted">
              Desde la dirección congelada de cada pedido pagado.
              {geography.pickup
                ? ` ${geography.pickup.orderCount} retiros en persona se agrupan aparte (${formatMoney(
                    geography.pickup.totalCents,
                  )}).`
                : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <MarketBarChart
              data={geography.provinces.slice(0, 8).map((row) => ({ label: row.label, value: row.totalCents }))}
              valueLabel="Ventas"
              format="money"
            />
            <LocationTable rows={geography.provinces} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Compras por ciudad</CardTitle>
            <p className="text-xs text-text-muted">
              <MapPin className="mr-1 inline size-3" aria-hidden /> El retiro en persona se muestra como categoría
              separada.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <MarketBarChart
              data={geography.cities.slice(0, 8).map((row) => ({ label: row.label, value: row.totalCents }))}
              valueLabel="Ventas"
              format="money"
            />
            <LocationTable rows={geography.cities} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Día de la semana</CardTitle>
            <p className="text-xs text-text-muted">Pedidos pagados según la fecha de pago, en hora argentina.</p>
          </CardHeader>
          <CardContent>
            <MarketBarChart
              data={timing.weekdays.map((day) => ({ label: day.label, value: day.orderCount }))}
              valueLabel="Pedidos"
            />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Franja horaria</CardTitle>
            <p className="text-xs text-text-muted">
              <Clock3 className="mr-1 inline size-3" aria-hidden /> Bloques de cuatro horas; hora de Argentina.
            </p>
          </CardHeader>
          <CardContent>
            <MarketBarChart
              data={timing.buckets.map((slot) => ({ label: slot.label, value: slot.orderCount }))}
              valueLabel="Pedidos"
              axisWidth={72}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Mapa de calor: día y franja</CardTitle>
          <p className="text-xs text-text-muted">
            Cada celda muestra pedidos pagados; cuanto más oscuro, más compras.
          </p>
        </CardHeader>
        <CardContent>
          <TimingHeatmap weekdays={timing.weekdays} buckets={timing.buckets} cells={timing.heatmap} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Embudo de conversión</CardTitle>
            <p className="text-xs text-text-muted">
              Visitas → carritos → pedidos creados → pedidos pagados. Tasas protegidas contra divisiones por cero.
            </p>
          </CardHeader>
          <CardContent>
            <FunnelSection steps={funnel.steps} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text">
              <AlertTriangle className="size-4 text-warning" aria-hidden /> Abandono de carrito
            </CardTitle>
            <p className="text-xs text-text-muted">
              {abandoned.count} carritos sin actividad desde hace {abandoned.olderThanHours} horas o más.
            </p>
          </CardHeader>
          <CardContent>
            <AbandonedSection abandoned={abandoned} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Visitados vs. comprados</CardTitle>
            <p className="text-xs text-text-muted">
              Productos activos con visitas en el período, ordenados por brecha entre visitas y compras.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ViewedVsPurchasedSection rows={viewedVsPurchased} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Recompra y valor por cliente</CardTitle>
            <p className="text-xs text-text-muted">
              {repeat.totalCustomers} clientes con pedidos pagados hasta el final del período.
            </p>
          </CardHeader>
          <CardContent>
            <RepeatSection repeat={repeat} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function AdminMarketPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Estudio de mercado</h1>
          <p className="mt-1 text-sm text-text-muted">
            Quién compra, cuánto y desde dónde en {siteConfig.name}.
          </p>
        </div>
        <Link href="/admin/estadisticas" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ver estadísticas <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <form
        method="get"
        action="/admin/mercado"
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="market-period">Período</Label>
          <select
            id="market-period"
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
        <div className="flex items-end gap-3">
          <Button type="submit" size="sm">
            Aplicar filtros
          </Button>
          <span className="text-xs text-text-muted">Los horarios se agrupan en hora de Argentina.</span>
        </div>
      </form>

      <Suspense fallback={<MarketSkeleton />}>
        <MarketContent query={query} />
      </Suspense>
    </main>
  );
}
