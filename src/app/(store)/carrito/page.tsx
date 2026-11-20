import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Suspense } from "react";
import { CartItemRow } from "@/components/store/cart-item-row";
import { CartMergeNotice } from "@/components/store/cart-merge-notice";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readCartMergeNotice } from "@/lib/cart/token";
import { formatMoney } from "@/lib/money";
import { getCartSummary } from "@/server/cart/actions";

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

async function CartContent() {
  const [summary, showMergeNotice] = await Promise.all([getCartSummary(), readCartMergeNotice()]);

  return (
    <>
      {showMergeNotice ? <CartMergeNotice /> : null}

      {summary.items.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ShoppingBag className="size-7" aria-hidden />
            </span>
            <div>
              <p className="font-heading text-xl font-bold text-text">Tu carrito está vacío</p>
              <p className="mt-1 text-sm text-text-muted">
                Explorá el catálogo y agregá lo que te guste. Tu carrito se guarda aunque cierres la página.
              </p>
            </div>
            <Link href="/catalogo" className={buttonVariants({ size: "lg" })}>
              Ver el catálogo
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-border bg-surface px-5 shadow-sm">
            <h2 className="sr-only">Productos en el carrito</h2>
            <ul>
              {summary.items.map((item) => (
                <CartItemRow key={item.id} item={item} />
              ))}
            </ul>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="border-border bg-surface shadow-sm">
              <CardContent className="space-y-4">
                <h2 className="font-heading text-lg font-bold text-text">Resumen de compra</h2>
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <span>Productos ({summary.itemCount})</span>
                  <span>{formatMoney(summary.subtotalCents)}</span>
                </div>
                {summary.warnings.length > 0 ? (
                  <ul className="space-y-1 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                    {summary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="font-semibold text-text">Subtotal</span>
                  <span className="font-heading text-xl font-extrabold text-primary">
                    {formatMoney(summary.subtotalCents)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  El envío se calcula al finalizar la compra.
                </p>
                <Link href="/checkout" className={buttonVariants({ size: "lg", className: "w-full" })}>
                  Continuar al pago
                </Link>
                <Link
                  href="/catalogo"
                  className="block text-center text-sm text-text-muted underline-offset-2 hover:text-primary hover:underline"
                >
                  Seguir comprando
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Tu carrito</h1>
        <p className="mt-2 text-text-muted">Revisá tus productos antes de continuar.</p>
      </div>
      <Suspense fallback={<CartSkeleton />}>
        <CartContent />
      </Suspense>
    </main>
  );
}
