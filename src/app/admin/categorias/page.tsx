import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryForm } from "@/components/admin/category-form";
import { listCategories } from "@/db/queries/catalog";
import { requireAdmin } from "@/lib/auth/helpers";
import { toggleCategoryActiveAction } from "@/server/admin/categories";

type Props = { searchParams: Promise<{ edit?: string | string[] }> };

export default async function AdminCategoriesPage({ searchParams }: Props) {
  await requireAdmin();
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : undefined;

  const categories = await listCategories({ includeInactive: true });
  const selected = categories.find((category) => category.id === editId);
  const parentNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold text-text">Categorías</h1>
      <p className="mt-1 text-sm text-text-muted">Organizá el catálogo y elegí el orden de exhibición.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <CategoryForm
            key={selected?.id ?? "new"}
            categories={categories}
            initial={
              selected
                ? {
                    id: selected.id,
                    name: selected.name,
                    slug: selected.slug,
                    parentId: selected.parentId,
                    position: selected.position,
                    active: selected.active,
                  }
                : { name: "", slug: "", parentId: null, position: categories.length, active: true }
            }
          />
          {selected ? (
            <Link href="/admin/categorias" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Cancelar edición
            </Link>
          ) : null}
        </div>

        <Card className="border-border bg-surface shadow-sm">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Padre</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-primary-soft/30">
                    <td className="px-4 py-3 font-medium text-text">{category.name}</td>
                    <td className="px-4 py-3 text-text-muted">{category.slug}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {category.parentId ? (parentNames.get(category.parentId) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-text">{category.productCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={category.active ? "default" : "secondary"}>
                        {category.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/categorias?edit=${category.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Editar
                        </Link>
                        <form action={toggleCategoryActiveAction}>
                          <input type="hidden" name="categoryId" value={category.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {category.active ? "Desactivar" : "Activar"}
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
      </div>
    </main>
  );
}
