import { ArrowRight, CreditCard, Leaf, Truck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/store/product-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getFeaturedProducts, getVisibleCategories } from "@/server/catalog";

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="h-72 animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}

async function HomeContent() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(4),
    getVisibleCategories(),
  ]);

  return (
    <>
      <section className="grid gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div className="flex flex-col justify-center gap-5">
          <Badge variant="secondary" className="w-fit bg-primary-soft text-primary">
            Hecho con cariño
          </Badge>
          <h1 className="font-heading text-4xl leading-tight text-text sm:text-5xl">
            Cosas lindas para tu día a día
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-text-muted">
            Descubrí nuestra selección de indumentaria, accesorios y detalles para el hogar.
            Comprá online, pagá con MercadoPago y recibilo donde quieras.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/catalogo" className={buttonVariants({ size: "lg" })}>
              Ver catálogo <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-wrap gap-5 pt-2 text-sm text-text-muted">
            <span className="inline-flex items-center gap-2">
              <Truck className="size-4 text-primary" aria-hidden /> Envíos a todo el país
            </span>
            <span className="inline-flex items-center gap-2">
              <Leaf className="size-4 text-primary" aria-hidden /> Retiro en persona
            </span>
          </div>
        </div>
        <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl bg-primary-soft p-8">
          <span className="font-heading text-4xl font-extrabold text-primary/80 sm:text-6xl">
            Estilo que abraza
          </span>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-text">Los más elegidos</h2>
            <p className="text-sm text-text-muted">Calculado con las ventas reales de la tienda.</p>
          </div>
          <Link href="/catalogo" className="text-sm font-semibold text-primary hover:underline">
            Ver todo
          </Link>
        </div>
        <Suspense fallback={<CardsSkeleton />}>
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="border-border bg-surface">
              <CardContent className="py-10 text-center text-text-muted">
                Todavía no hay productos destacados. Volvé pronto.
              </CardContent>
            </Card>
          )}
        </Suspense>
      </section>

      <section className="bg-surface-muted/60 px-4 py-12 sm:px-6">
        <div className="mb-5">
          <h2 className="font-heading text-2xl font-bold text-text">Explorá por categoría</h2>
          <p className="text-sm text-text-muted">Encontrá justo lo que buscás.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/catalogo?category=${category.slug}`}
              className="rounded-2xl border border-border bg-surface px-5 py-3 font-heading font-semibold text-text shadow-sm transition-colors hover:border-primary hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6">
        <Card className="border-accent/40 bg-accent/15">
          <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center">
            <CreditCard className="size-8 text-text" aria-hidden />
            <div>
              <p className="font-heading text-lg font-bold text-text">Pagá como quieras</p>
              <p className="text-sm text-text-muted">
                Tarjetas de crédito, débito y dinero en cuenta con MercadoPago.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="flex-1">
      <Suspense fallback={<div className="px-4 py-16 text-text-muted">Cargando la tienda…</div>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
