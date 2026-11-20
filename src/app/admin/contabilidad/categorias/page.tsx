import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseCategoryForm } from "@/components/admin/accounting/expense-category-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/helpers";
import { listExpenseCategories } from "@/server/accounting/queries";
import { toggleExpenseCategoryActiveAction } from "@/server/admin/accounting";

type Props = { searchParams: Promise<{ edit?: string | string[] }> };

function CategoriesSkeleton() {
  return <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-muted" />;
}

async function CategoriesContent({ editId }: { editId?: string }) {
  await connection();
  await requireAdmin();
  const categories = await listExpenseCategories();
  const selected = categories.find((category) => category.id === editId);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <ExpenseCategoryForm
          key={selected?.id ?? "new"}
          initial={
            selected
              ? {
                  id: selected.id,
                  name: selected.name,
                  color: selected.color,
                  active: selected.active,
                }
              : { name: "", color: null, active: true }
          }
        />
        {selected ? (
          <Link
            href="/admin/contabilidad/categorias"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Cancelar edición
          </Link>
        ) : null}
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Egresos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-primary-soft/30">
                  <td className="px-4 py-3 font-medium text-text">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-3 rounded-full border border-border"
                        style={{ backgroundColor: category.color ?? "var(--surface-muted)" }}
                        aria-hidden
                      />
                      {category.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{category.expenseCount}</td>
                  <td className="px-4 py-3">
                    <Badge variant={category.active ? "default" : "secondary"}>
                      {category.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/contabilidad/categorias?edit=${category.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Editar
                      </Link>
                      <form action={toggleExpenseCategoryActiveAction}>
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
  );
}

export default async function AdminExpenseCategoriesPage({ searchParams }: Props) {
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold text-text">Categorías de egreso</h1>
      <p className="mt-1 text-sm text-text-muted">
        Organizá los egresos por rubro. Las categorías se desactivan, nunca se borran.
      </p>
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContent editId={editId} />
      </Suspense>
    </main>
  );
}
