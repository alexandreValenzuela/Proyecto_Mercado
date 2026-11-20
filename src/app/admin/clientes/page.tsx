import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listAdminCustomers } from "@/db/queries/customers";
import {
  adminCustomerQuerySchema,
  type AdminCustomerQuery,
} from "@/lib/validators/customers";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 12;

function parseQuery(raw: Record<string, string | string[] | undefined>): AdminCustomerQuery {
  const parsed = adminCustomerQuerySchema.safeParse(raw);
  return parsed.success ? parsed.data : adminCustomerQuerySchema.parse({});
}

function hrefFor(query: AdminCustomerQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  params.set("page", String(page));
  return `/admin/clientes?${params.toString()}`;
}

function CustomersSkeleton() {
  return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="px-4 py-10 text-center text-sm text-text-muted">{message}</p>;
}

async function CustomersContent({ query }: { query: AdminCustomerQuery }) {
  await connection();
  // El proxy es la primera barrera; la query del panel vuelve a verificar el rol.
  await requireAdmin();
  const { items, total } = await listAdminCustomers({
    query: query.q,
    page: query.page,
    pageSize: PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <form
        method="get"
        action="/admin/clientes"
        className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="customers-q">Buscar</Label>
          <Input
            id="customers-q"
            name="q"
            defaultValue={query.q}
            placeholder="Nombre o email"
          />
        </div>
        <Button type="submit" size="sm">
          Buscar
        </Button>
      </form>

      <p className="mb-3 text-sm text-text-muted">
        {total} {total === 1 ? "cliente" : "clientes"}
      </p>

      {items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="p-0">
            <EmptyMessage message="No hay clientes para mostrar. Probá con otro nombre o email." />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total gastado</th>
                  <th className="px-4 py-3">Alta</th>
                  <th className="px-4 py-3">Etiqueta</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{customer.name}</p>
                      <p className="text-xs text-text-muted">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{customer.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-text">{customer.orderCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                      {formatMoney(customer.totalSpentCents)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">
                      {customer.isDemo ? <Badge variant="secondary">Demo</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clientes/${customer.id}`}
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

export default async function AdminCustomersPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-text">Clientes</h1>
        <p className="mt-1 text-sm text-text-muted">
          Mirá quiénes compraron y cuánto gastaron. El total incluye los pedidos pagados, en preparación, enviados y entregados.
        </p>
      </div>
      <Suspense fallback={<CustomersSkeleton />}>
        <CustomersContent query={query} />
      </Suspense>
    </main>
  );
}
