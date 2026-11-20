import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listCategories, listProducts } from "@/db/queries/catalog";
import { requireAdmin } from "@/lib/auth/helpers";
import { formatMoney, parsePriceToCents } from "@/lib/money";
import {
  adminProductQuerySchema,
  type AdminResolvedQuery,
} from "@/lib/validators/catalog";
import { toggleProductActiveAction } from "@/server/admin/products";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 12;

function parseQuery(raw: Record<string, string | string[] | undefined>): AdminResolvedQuery {
  const parsed = adminProductQuerySchema.safeParse(raw);
  const data = parsed.success ? parsed.data : adminProductQuerySchema.parse({});
  return {
    q: data.q,
    category: data.category,
    sort: data.sort,
    page: data.page,
    active: data.active,
    min: data.min ? (parsePriceToCents(data.min) ?? undefined) : undefined,
    max: data.max ? (parsePriceToCents(data.max) ?? undefined) : undefined,
  };
}

function hrefFor(query: AdminResolvedQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.active !== "all") params.set("active", query.active);
  if (query.sort !== "relevance") params.set("sort", query.sort);
  params.set("page", String(page));
  return `/admin/productos?${params.toString()}`;
}

function ProductsSkeleton() {
  return <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />;
}

async function ProductsContent({ query }: { query: AdminResolvedQuery }) {
  const [catalog, categories] = await Promise.all([
    listProducts({
      includeInactive: true,
      activeFilter: query.active,
      q: query.q || undefined,
      categorySlug: query.category || undefined,
      minPriceCents: query.min,
      maxPriceCents: query.max,
      sort: query.sort,
      page: query.page,
      pageSize: PAGE_SIZE,
    }),
    listCategories({ includeInactive: true }),
  ]);
  const pageCount = Math.max(1, Math.ceil(catalog.total / PAGE_SIZE));

  return (
    <>
      <form method="get" action="/admin/productos" className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="admin-q">Buscar</Label>
          <Input id="admin-q" name="q" defaultValue={query.q} placeholder="Nombre del producto" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-category">Categoría</Label>
          <select
            id="admin-category"
            name="category"
            defaultValue={query.category}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-active">Estado</Label>
          <select
            id="admin-active"
            name="active"
            defaultValue={query.active}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-sort">Orden</Label>
          <select
            id="admin-sort"
            name="sort"
            defaultValue={query.sort}
            className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
          >
            <option value="relevance">Relevancia</option>
            <option value="newest">Novedades</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
            <option value="best-selling">Más vendidos</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-4">
          <Button type="submit" size="sm">Filtrar</Button>
        </div>
      </form>

      <p className="mb-3 text-sm text-text-muted">
        {catalog.total} {catalog.total === 1 ? "producto" : "productos"}
      </p>

      {catalog.items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="py-12 text-center text-text-muted">
            No hay productos que coincidan con los filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {catalog.items.map((product) => (
                  <tr key={product.id} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3 font-medium text-text">{product.name}</td>
                    <td className="px-4 py-3 text-text-muted">{product.categoryName}</td>
                    <td className="px-4 py-3 text-text">{formatMoney(product.effectivePriceCents)}</td>
                    <td className="px-4 py-3 text-text">{product.stockTotal}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.active ? "default" : "secondary"}>
                        {product.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/productos/${product.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Editar
                        </Link>
                        <form action={toggleProductActiveAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {product.active ? "Desactivar" : "Activar"}
                          </Button>
                        </form>
                      </div>
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
          <span className="text-sm text-text-muted">{query.page} / {pageCount}</span>
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

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireAdmin();
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Productos</h1>
          <p className="mt-1 text-sm text-text-muted">Alta, edición, imágenes, variantes y stock.</p>
        </div>
        <Link href="/admin/productos/nuevo" className={buttonVariants()}>
          Nuevo producto
        </Link>
      </div>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent query={query} />
      </Suspense>
    </main>
  );
}
