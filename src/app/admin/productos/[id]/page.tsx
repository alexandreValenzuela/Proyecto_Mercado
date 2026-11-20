import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { StockAdjustmentForm } from "@/components/admin/stock-adjustment-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminProductById, getVariantStockHistory, listCategories } from "@/db/queries/catalog";
import { requireAdmin } from "@/lib/auth/helpers";

type Props = { params: Promise<{ id: string }> };

const reasonLabels: Record<string, string> = {
  sale: "Venta",
  restock: "Reposición",
  adjustment: "Ajuste",
  cancellation: "Cancelación",
};

export default async function EditProductPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    getAdminProductById(id),
    listCategories({ includeInactive: true }),
  ]);
  if (!product) {
    notFound();
  }

  const histories = await Promise.all(
    product.variants.slice(0, 4).map(async (variant) => ({
      variant,
      movements: await getVariantStockHistory(variant.id, 10),
    })),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Editar producto</h1>
          <p className="mt-1 text-sm text-text-muted">{product.name}</p>
        </div>
        <Link href="/admin/productos" className={buttonVariants({ variant: "outline" })}>
          Volver
        </Link>
      </div>

      <ProductForm
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          categoryId: product.categoryId,
          basePriceCents: product.basePriceCents,
          costCents: product.costCents,
          active: product.active,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            label: variant.label,
            attributes: variant.attributes,
            priceCents: variant.priceCents,
            costCents: variant.costCents,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            active: variant.active,
          })),
          images: product.images.map((image) => ({
            id: image.id,
            url: image.url,
            publicId: image.publicId,
            position: image.position,
          })),
        }}
      />

      <div className="mt-8 space-y-5">
        <StockAdjustmentForm
          variants={product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            label: variant.label,
            stock: variant.stock,
          }))}
        />

        {histories.map(({ variant, movements }) => (
          <Card key={variant.id} className="border-border bg-surface shadow-sm">
            <CardHeader>
              <CardTitle className="text-text">
                Historial de stock · {variant.sku}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-text-muted">Todavía no hay movimientos de stock.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-text-muted">
                      <tr>
                        <th className="py-2">Fecha</th>
                        <th className="py-2">Motivo</th>
                        <th className="py-2">Ajuste</th>
                        <th className="py-2">Nota</th>
                        <th className="py-2">Usuario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {movements.map((movement) => (
                        <tr key={movement.id}>
                          <td className="py-2 text-text-muted">
                            {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(movement.createdAt)}
                          </td>
                          <td className="py-2 text-text">{reasonLabels[movement.reason] ?? movement.reason}</td>
                          <td className={`py-2 font-semibold ${movement.delta > 0 ? "text-success" : "text-danger"}`}>
                            {movement.delta > 0 ? "+" : ""}{movement.delta}
                          </td>
                          <td className="py-2 text-text-muted">{movement.note ?? "—"}</td>
                          <td className="py-2 text-text-muted">{movement.createdByName ?? "Sistema"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
