"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAccountingActionState } from "@/lib/accounting/action-types";
import { centsToInput } from "@/lib/money";
import { saveExpenseAction } from "@/server/admin/accounting";

export type ExpenseFormInitial = {
  id?: string;
  categoryId: string;
  description: string;
  amountCents: number | null;
  expenseDate: string;
  notes: string;
};

export function ExpenseForm({
  categories,
  initial,
  today,
}: {
  categories: Array<{ id: string; name: string }>;
  initial: ExpenseFormInitial;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveExpenseAction,
    initialAccountingActionState,
  );

  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardHeader>
        <CardTitle className="text-text">{initial.id ? "Editar egreso" : "Nuevo egreso"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">Categoría</Label>
            <select
              id="expense-category"
              name="categoryId"
              defaultValue={initial.categoryId}
              className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
              aria-invalid={Boolean(state.fieldErrors.categoryId)}
            >
              <option value="">Elegí una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {state.fieldErrors.categoryId ? (
              <p className="text-xs text-danger">{state.fieldErrors.categoryId}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Descripción</Label>
            <Input
              id="expense-description"
              name="description"
              defaultValue={initial.description}
              placeholder="Ej.: Compra de materiales"
              aria-invalid={Boolean(state.fieldErrors.description)}
            />
            {state.fieldErrors.description ? (
              <p className="text-xs text-danger">{state.fieldErrors.description}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Importe en pesos</Label>
              <Input
                id="expense-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={centsToInput(initial.amountCents)}
                placeholder="12500.50"
                aria-invalid={Boolean(state.fieldErrors.amount)}
              />
              {state.fieldErrors.amount ? (
                <p className="text-xs text-danger">{state.fieldErrors.amount}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input
                id="expense-date"
                name="expenseDate"
                type="date"
                defaultValue={initial.expenseDate || today}
                aria-invalid={Boolean(state.fieldErrors.expenseDate)}
              />
              {state.fieldErrors.expenseDate ? (
                <p className="text-xs text-danger">{state.fieldErrors.expenseDate}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notas (opcional)</Label>
            <textarea
              id="expense-notes"
              name="notes"
              rows={3}
              defaultValue={initial.notes}
              className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm"
              aria-invalid={Boolean(state.fieldErrors.notes)}
            />
            {state.fieldErrors.notes ? (
              <p className="text-xs text-danger">{state.fieldErrors.notes}</p>
            ) : null}
          </div>
          {state.message ? (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-xs ${
                state.status === "error"
                  ? "bg-danger/10 text-danger"
                  : "bg-primary-soft text-primary"
              }`}
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar egreso"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
