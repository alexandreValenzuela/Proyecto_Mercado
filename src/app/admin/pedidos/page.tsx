import { AlertTriangle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAdminOrders } from "@/db/queries/orders";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatOrderNumber, ORDER_STATUS_LABELS } from "@/lib/checkout/status";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  adminOrderQuerySchema,
  type AdminOrderQuery,
} from "@/lib/validators/admin-orders";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 12;

function parseQuery(raw: Record<string, string | string[] | undefined>): AdminOrderQuery {
  const parsed = adminOrderQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : adminOrderQuerySchema.parse({});
}

function hrefFor(query: AdminOrderQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.status !== "all") params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q) params.set("q", query.q);
  params.set("page", String(page));
  return `/admin/pedidos?${params.toString()}`;
}

function OrdersSkeleton() {
  return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
}

async function OrdersContent({ query }: { query: AdminOrderQuery }) {
  await connection();
  // El proxy es la primera barrera; la query del panel vuelve a verificar el rol.
  await requireAdmin();
  const { items, total } = await listAdminOrders(query, PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <form
        method="get"
        action="/admin/pedidos"
        className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="orders-q">Buscar</Label>
          <Input
            id="orders-q"
            name="q"
            defaultValue={query.q}
            placeholder="Número, nombre o email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orders-status">Estado</Label>
          <select
            id="orders-status"
            name="status"
            defaultValue={query.status}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            <option value="all">Todos</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orders-from">Desde</Label>
          <Input id="orders-from" name="from" type="date" defaultValue={query.from ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orders-to">Hasta</Label>
          <Input id="orders-to" name="to" type="date" defaultValue={query.to ?? ""} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </div>
      </form>

      <p className="mb-3 text-sm text-text-muted">
        {total} {total === 1 ? "pedido" : "pedidos"}
      </p>

      {items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ClipboardList className="size-6" aria-hidden />
            </span>
            <p className="font-heading text-lg font-bold text-text">No hay pedidos para mostrar</p>
            <p className="text-sm text-text-muted">Probá con otros filtros o fechas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((order) => (
                  <tr key={order.id} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3 font-medium text-text">
                      {formatOrderNumber(order.number)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-text">{order.customerName}</p>
                      <p className="text-xs text-text-muted">{order.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-text">
                      {formatMoney(order.totalCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <OrderStatusBadge status={order.status} />
                        {order.manualReview ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning"
                            title={order.mpStatus ?? "Revisión manual"}
                          >
                            <AlertTriangle className="size-3" aria-hidden />
                            Revisión manual
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {order.paymentMethod ?? "—"}
                      {order.shippingMethod === "pickup" ? (
                        <span className="block text-xs">Retiro</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {pageCount > 1 ? (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginación">
          {query.page > 1 ? (
            <Link href={hrefFor(query, query.page - 1)} className={buttonVariants({ variant: "outline" })}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-text-muted">
            {query.page} / {pageCount}
          </span>
          {query.page < pageCount ? (
            <Link href={hrefFor(query, query.page + 1)} className={buttonVariants({ variant: "outline" })}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-text">Pedidos</h1>
        <p className="mt-1 text-sm text-text-muted">
          Buscá, revisá el estado y gestioná las ventas.
        </p>
      </div>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersContent query={query} />
      </Suspense>
    </main>
  );
}
