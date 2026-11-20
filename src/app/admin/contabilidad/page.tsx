import { AlertTriangle, CircleDollarSign, Receipt, TrendingUp } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExpensesByCategoryChart } from "@/components/admin/accounting/expenses-by-category-chart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatPeriodDate, resolveAccountingPeriod } from "@/lib/accounting/periods";
import { formatMoney } from "@/lib/money";
import {
  ACCOUNTING_MOVEMENT_LIMIT,
  getAccountingBalance,
  getCostOfSales,
  getExpensesByCategory,
  getUnifiedMovements,
} from "@/server/accounting/queries";
import {
  accountingPeriodQuerySchema,
  type AccountingPeriodQuery,
} from "@/lib/validators/accounting";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const PERIOD_LABELS: Record<AccountingPeriodQuery["period"], string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
  custom: "Rango libre",
};

function parseQuery(raw: Record<string, string | string[] | undefined>): AccountingPeriodQuery {
  const parsed = accountingPeriodQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : accountingPeriodQuerySchema.parse({});
}

function hrefFor(query: AccountingPeriodQuery, sort: AccountingPeriodQuery["sort"]): string {
  const params = new URLSearchParams();
  params.set("period", query.period);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("sort", sort);
  return `/admin/contabilidad?${params.toString()}`;
}

function AccountingSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}

async function AccountingContent({ query }: { query: AccountingPeriodQuery }) {
  await connection();
  // El proxy es la primera barrera; cada query vuelve a verificar el rol.
  await requireAdmin();
  const range = resolveAccountingPeriod(query);
  const [balance, cost, byCategory, movements] = await Promise.all([
    getAccountingBalance(range),
    getCostOfSales(range),
    getExpensesByCategory(range),
    getUnifiedMovements(range, query.sort),
  ]);

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-text-muted">{range.label}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-text-muted">
              <TrendingUp className="size-4 text-primary" aria-hidden /> Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-text">
              {formatMoney(balance.incomeCents)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {balance.orderCount} {balance.orderCount === 1 ? "pedido pagado" : "pedidos pagados"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-text-muted">
              <Receipt className="size-4 text-accent" aria-hidden /> Egresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-text">
              {formatMoney(balance.expenseCents)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {balance.expenseCount} {balance.expenseCount === 1 ? "egreso" : "egresos"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-text-muted">
              <CircleDollarSign className="size-4 text-primary" aria-hidden /> Resultado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`font-heading text-2xl font-bold ${
                balance.resultCents < 0 ? "text-danger" : "text-primary"
              }`}
            >
              {formatMoney(balance.resultCents)}
            </p>
            <p className="mt-1 text-xs text-text-muted">Ingresos menos egresos</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Margen bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold text-text">
              {formatMoney(cost.grossMarginCents)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {cost.grossMarginPercent.toFixed(1)}% de las ventas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Costo de ventas y margen bruto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Ventas</p>
              <p className="mt-1 font-semibold text-text">{formatMoney(cost.salesCents)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Costo de ventas</p>
              <p className="mt-1 font-semibold text-text">{formatMoney(cost.costCents)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Margen bruto</p>
              <p className="mt-1 font-semibold text-text">{formatMoney(cost.grossMarginCents)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Ítems vendidos</p>
              <p className="mt-1 font-semibold text-text">{cost.soldItems}</p>
            </div>
          </div>
          {cost.incomplete ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Margen incompleto: {cost.missingCostItems}{" "}
              {cost.missingCostItems === 1 ? "ítem vendido no tiene" : "ítems vendidos no tienen"}{" "}
              costo cargado. El margen mostrado es solo una estimación.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Egresos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart data={byCategory} />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-text">Movimientos del período</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {movements.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-text-muted">
                No hay movimientos en el período elegido.
              </p>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-4 py-3">
                      <Link
                        href={hrefFor(query, query.sort === "date-asc" ? "date-desc" : "date-asc")}
                        className="hover:text-primary"
                        aria-label="Ordenar por fecha"
                      >
                        Fecha {query.sort === "date-asc" ? "↑" : "↓"}
                      </Link>
                    </th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Detalle</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-primary-soft/30">
                      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                        {formatPeriodDate(movement.dateKey)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            movement.kind === "income"
                              ? "bg-primary-soft text-primary"
                              : "bg-accent/20 text-text"
                          }`}
                        >
                          {movement.kind === "income" ? "Ingreso" : "Egreso"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text">
                        {movement.orderId ? (
                          <Link
                            href={`/admin/pedidos/${movement.orderId}`}
                            className="hover:underline"
                          >
                            {movement.description}
                          </Link>
                        ) : (
                          movement.description
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{movement.categoryName ?? "—"}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                          movement.kind === "income" ? "text-primary" : "text-danger"
                        }`}
                      >
                        {movement.kind === "income" ? "+" : "−"}
                        {formatMoney(movement.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
          {movements.length >= ACCOUNTING_MOVEMENT_LIMIT ? (
            <p className="px-4 pb-4 text-xs text-text-muted">
              Se muestran los últimos {ACCOUNTING_MOVEMENT_LIMIT} movimientos del período.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export default async function AdminAccountingPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Contabilidad</h1>
          <p className="mt-1 text-sm text-text-muted">
            Balance, costos y movimientos con datos reales de tus ventas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/contabilidad/egresos"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Gestionar egresos
          </Link>
          <Link
            href="/admin/contabilidad/categorias"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Categorías de egreso
          </Link>
        </div>
      </div>

      <form
        method="get"
        action="/admin/contabilidad"
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="space-y-1.5">
          <Label htmlFor="accounting-period">Período</Label>
          <select
            id="accounting-period"
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
          <Label htmlFor="accounting-from">Desde</Label>
          <Input id="accounting-from" name="from" type="date" defaultValue={query.from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accounting-to">Hasta</Label>
          <Input id="accounting-to" name="to" type="date" defaultValue={query.to ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accounting-sort">Orden de movimientos</Label>
          <select
            id="accounting-sort"
            name="sort"
            defaultValue={query.sort}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            <option value="date-desc">Más recientes primero</option>
            <option value="date-asc">Más antiguos primero</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm">
            Aplicar filtros
          </Button>
        </div>
      </form>

      <Suspense fallback={<AccountingSkeleton />}>
        <AccountingContent query={query} />
      </Suspense>
    </main>
  );
}
