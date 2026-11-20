import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { buttonVariants } from "@/components/ui/button";
import { listCategories } from "@/db/queries/catalog";
import { requireAdmin } from "@/lib/auth/helpers";

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await listCategories({ includeInactive: true });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text">Nuevo producto</h1>
          <p className="mt-1 text-sm text-text-muted">Cargá datos, variantes y precios.</p>
        </div>
        <Link href="/admin/productos" className={buttonVariants({ variant: "outline" })}>
          Volver
        </Link>
      </div>
      <ProductForm
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        initial={{
          name: "",
          slug: "",
          description: "",
          categoryId: categories[0]?.id ?? "",
          basePriceCents: 0,
          costCents: null,
          active: true,
          variants: [],
          images: [],
        }}
      />
    </main>
  );
}
