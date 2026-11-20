import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInput } from "@/lib/money";
import type { CatalogCategory } from "@/db/queries/catalog";
import type { CatalogResolvedQuery } from "@/lib/validators/catalog";

export function CatalogFilters({
  categories,
  query,
}: {
  categories: CatalogCategory[];
  query: CatalogResolvedQuery;
}) {
  return (
    <form method="get" action="/catalogo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="catalog-q">Buscar</Label>
        <Input id="catalog-q" name="q" defaultValue={query.q} placeholder="Nombre o descripción" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catalog-category">Categoría</Label>
        <select
          id="catalog-category"
          name="category"
          defaultValue={query.category}
          className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm text-text outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <Label htmlFor="catalog-min">Precio mínimo</Label>
        <Input
          id="catalog-min"
          name="min"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={centsToInput(query.min)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catalog-max">Precio máximo</Label>
        <Input
          id="catalog-max"
          name="max"
          inputMode="decimal"
          placeholder="Sin límite"
          defaultValue={centsToInput(query.max)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catalog-sort">Ordenar por</Label>
        <select
          id="catalog-sort"
          name="sort"
          defaultValue={query.sort}
          className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm text-text outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="relevance">Relevancia</option>
          <option value="best-selling">Más vendidos</option>
          <option value="newest">Novedades</option>
          <option value="price-asc">Menor precio</option>
          <option value="price-desc">Mayor precio</option>
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
        <Button type="submit" size="lg">
          Aplicar filtros
        </Button>
        <Button type="button" variant="ghost" size="lg" render={<Link href="/catalogo" />}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}
