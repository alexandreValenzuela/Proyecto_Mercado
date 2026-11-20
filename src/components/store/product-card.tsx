import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStockState, stockLabels } from "@/lib/catalog/stock";
import { formatMoney } from "@/lib/money";
import type { CatalogProduct } from "@/db/queries/catalog";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const stockState = getStockState(product.stockTotal);

  return (
    <Card className="group h-full overflow-hidden border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-primary-soft/40">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              Imagen próximamente
            </div>
          )}
          {stockState === "out" ? (
            <Badge variant="destructive" className="absolute left-3 top-3">
              {stockLabels.out}
            </Badge>
          ) : stockState === "low" ? (
            <Badge className="absolute left-3 top-3 bg-accent text-text">{stockLabels.low}</Badge>
          ) : null}
        </div>
      </Link>
      <CardContent className="flex flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {product.categoryName}
        </p>
        <Link href={`/producto/${product.slug}`} className="font-heading text-base font-semibold text-text hover:text-primary">
          {product.name}
        </Link>
        <p className="mt-auto text-lg font-bold text-primary">
          {formatMoney(product.effectivePriceCents)}
        </p>
      </CardContent>
    </Card>
  );
}
