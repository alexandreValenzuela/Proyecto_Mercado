import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/admin/accounting/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/helpers";
import { todayInArgentina, formatPeriodDate } from "@/lib/accounting/periods";
import { formatMoney } from "@/lib/money";
import { listExpenseCategories, listExpenses } from "@/server/accounting/queries";
import { deleteExpenseAction } from "@/server/admin/accounting";

type Props = { searchParams: Promise<{ edit?: string | string[] }> };

function ExpensesSkeleton() {
  return <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-muted" />;
}

async function ExpensesContent({ editId }: { editId?: string }) {
  await connection();
  await requireAdmin();
  const [expenses, categories] = await Promise.all([listExpenses(), listExpenseCategories()]);
  const selected = expenses.find((expense) => expense.id === editId);
  const formCategories = categories
    .filter((category) => category.active || category.id === selected?.categoryId)
    .map((category) => ({ id: category.id, name: category.name }));

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <ExpenseForm
          key={selected?.id ?? "new"}
          categories={formCategories}
          today={todayInArgentina()}
          initial={
            selected
              ? {
                  id: selected.id,
                  categoryId: selected.categoryId,
                  description: selected.description,
                  amountCents: selected.amountCents,
                  expenseDate: selected.expenseDate,
                  notes: selected.notes ?? "",
                }
              : {
                  categoryId: formCategories[0]?.id ?? "",
                  description: "",
                  amountCents: null,
                  expenseDate: "",
                  notes: "",
                }
          }
        />
        {selected ? (
          <Link
            href="/admin/contabilidad/egresos"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Cancelar edición
          </Link>
        ) : null}
      </div>

      <Card className="border-border bg-surface shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          {expenses.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-text-muted">
              Todavía no cargaste egresos.
            </p>
          ) : (
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-surface-muted/70 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-primary-soft/30">
                    <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                      {formatPeriodDate(expense.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-text">
                      <span className="block max-w-[220px] truncate" title={expense.description}>
                        {expense.description}
                      </span>
                      {expense.isDemo ? (
                        <Badge variant="secondary" className="mt-1">
                          Demo
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {expense.categoryName ?? "Sin categoría"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-danger">
                      {formatMoney(expense.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/contabilidad/egresos?edit=${expense.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Editar
                        </Link>
                        <form action={deleteExpenseAction}>
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Eliminar
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-text-muted">Se muestran los 300 egresos más recientes.</p>
    </div>
  );
}

export default async function AdminExpensesPage({ searchParams }: Props) {
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold text-text">Egresos</h1>
      <p className="mt-1 text-sm text-text-muted">
        Cargá y editá los gastos del emprendimiento. Los importes se guardan en pesos argentinos.
      </p>
      <Suspense fallback={<ExpensesSkeleton />}>
        <ExpensesContent editId={editId} />
      </Suspense>
    </main>
  );
}
