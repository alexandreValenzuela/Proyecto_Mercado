import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/store/catalog-filters";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CATALOG_PAGE_SIZE, getCatalogPage, getVisibleCategories } from "@/server/catalog";
import { parsePriceToCents } from "@/lib/money";
import { catalogQuerySchema, type CatalogResolvedQuery } from "@/lib/validators/catalog";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseQuery(raw: Record<string, string | string[] | undefined>): CatalogResolvedQuery {
  const parsed = catalogQuerySchema.safeParse(raw);
  const data = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  return {
    q: data.q,
    category: data.category,
    sort: data.sort,
    page: data.page,
    min: data.min ? (parsePriceToCents(data.min) ?? undefined) : undefined,
    max: data.max ? (parsePriceToCents(data.max) ?? undefined) : undefined,
  };
}

function pageHref(query: CatalogResolvedQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.min != null) params.set("min", String(query.min));
  if (query.max != null) params.set("max", String(query.max));
  if (query.sort !== "relevance") params.set("sort", query.sort);
  params.set("page", String(page));
  return `/catalogo?${params.toString()}`;
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}

async function CatalogContent({ query }: { query: CatalogResolvedQuery }) {
  const [{ items, total }, categories] = await Promise.all([
    getCatalogPage(query),
    getVisibleCategories(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));

  return (
    <>
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <CatalogFilters categories={categories} query={query} />
      </div>

      <p className="mb-4 text-sm text-text-muted" aria-live="polite">
        {total === 0
          ? "No encontramos productos con esos filtros."
          : `${total} ${total === 1 ? "producto encontrado" : "productos encontrados"} · Página ${query.page} de ${pageCount}`}
      </p>

      {items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="font-heading text-xl font-bold text-text">No encontramos resultados</p>
            <p className="max-w-md text-sm text-text-muted">
              Probá con otra búsqueda, quitá algún filtro o mirá todas las categorías.
            </p>
            <Link href="/catalogo" className={buttonVariants({ variant: "outline" })}>
              Ver todo el catálogo
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Paginación">
          {query.page > 1 ? (
            <Link href={pageHref(query, query.page - 1)} className={buttonVariants({ variant: "outline" })}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-text-muted">
            {query.page} / {pageCount}
          </span>
          {query.page < pageCount ? (
            <Link href={pageHref(query, query.page + 1)} className={buttonVariants({ variant: "outline" })}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export default async function CatalogPage({ searchParams }: Props) {
  const query = parseQuery(await searchParams);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Catálogo</h1>
        <p className="mt-2 text-text-muted">Elegí, compará y encontrá tu próximo favorito.</p>
      </div>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent query={query} />
      </Suspense>
    </main>
  );
}
