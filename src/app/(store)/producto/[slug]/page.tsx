import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchasePanel, type PurchaseVariant } from "@/components/store/product-purchase-panel";
import { ProductViewTracker } from "@/components/store/product-view-tracker";
import { getProductDetail } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }> };

async function ProductContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) {
    notFound();
  }

  const variants: PurchaseVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: variant.label,
    attributes: variant.attributes,
    priceCents: variant.priceCents,
    stock: variant.stock,
    lowStockThreshold: variant.lowStockThreshold,
  }));

  return (
    <>
      <ProductViewTracker productId={product.id} />
      <nav className="mb-6 text-sm text-text-muted" aria-label="Ruta de navegación">
        <Link href="/" className="hover:text-primary">
          Inicio
        </Link>
        <span className="px-2">/</span>
        <Link href="/catalogo" className="hover:text-primary">
          Catálogo
        </Link>
        <span className="px-2">/</span>
        <span className="text-text">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images.map((image) => ({ id: image.id, url: image.url }))} name={product.name} />
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
              {product.category.name}
            </p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-text sm:text-4xl">
              {product.name}
            </h1>
          </div>
          <ProductPurchasePanel basePriceCents={product.basePriceCents} variants={variants} />
          <section className="border-t border-border pt-5">
            <h2 className="font-heading text-lg font-bold text-text">Descripción</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {product.description || "Este producto todavía no tiene descripción."}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export default function ProductPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<div className="py-16 text-center text-text-muted">Cargando producto…</div>}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}
