import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminCustomerDetail } from "@/db/queries/customers";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatOrderNumber } from "@/lib/checkout/status";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Props = { params: Promise<{ id: string }> };

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

async function CustomerDetailContent({ params }: { params: Props["params"] }) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  // El rol se verifica acá y también en la query del panel.
  await requireAdmin();
  const detail = await getAdminCustomerDetail(id);
  if (!detail) {
    notFound();
  }

  const { user, addresses, orders } = detail;

  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-bold text-text">{user.name}</p>
            <p className="mt-1 text-sm text-text-muted">{user.email}</p>
            <p className="mt-1 text-sm text-text-muted">
              Cliente desde el {formatDateTime(user.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {user.isDemo ? <Badge variant="secondary">Demo</Badge> : null}
            <p className="text-sm text-text-muted">
              {orders.length} {orders.length === 1 ? "pedido registrado" : "pedidos registrados"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Datos de contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-muted">
          <p>
            Teléfono: <span className="text-text">{user.phone ?? "—"}</span>
          </p>
          <p className="text-xs">
            Los pedidos guardan la dirección congelada al momento de la compra; las direcciones de abajo son las que el cliente tiene guardadas hoy.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Direcciones guardadas</CardTitle>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Este cliente todavía no guardó direcciones.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {addresses.map((address) => (
                <li key={address.id} className="rounded-xl border border-border bg-surface-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-text">{address.recipientName}</p>
                    {address.isDefault ? <Badge variant="outline">Predeterminada</Badge> : null}
                  </div>
                  <p className="mt-1 text-text-muted">{address.phone}</p>
                  <p className="mt-1 text-text-muted">
                    {address.street} {address.number}
                    {address.floorApt ? `, ${address.floorApt}` : ""}
                  </p>
                  <p className="text-text-muted">
                    {address.city}, {address.province} · CP {address.postalCode}
                  </p>
                  {address.notes ? <p className="mt-1 text-xs text-text-muted">{address.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Historial de pedidos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {orders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              Este cliente todavía no tiene pedidos.
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Pagado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className="font-medium text-text hover:underline"
                      >
                        {formatOrderNumber(order.number)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-text">
                      {formatMoney(order.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Link href="/admin/clientes" className={buttonVariants({ variant: "outline" })}>
        Volver a clientes
      </Link>
    </div>
  );
}

export default function AdminCustomerDetailPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-text">Detalle del cliente</h1>
        <p className="mt-1 text-sm text-text-muted">
          Direcciones guardadas y pedidos realizados.
        </p>
      </div>
      <Suspense fallback={<DetailSkeleton />}>
        <CustomerDetailContent params={params} />
      </Suspense>
    </main>
  );
}
