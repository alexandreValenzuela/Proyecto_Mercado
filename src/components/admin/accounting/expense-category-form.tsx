"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAccountingActionState } from "@/lib/accounting/action-types";
import { saveExpenseCategoryAction } from "@/server/admin/accounting";

export type ExpenseCategoryFormInitial = {
  id?: string;
  name: string;
  color: string | null;
  active: boolean;
};

export function ExpenseCategoryForm({ initial }: { initial: ExpenseCategoryFormInitial }) {
  const [state, formAction, pending] = useActionState(
    saveExpenseCategoryAction,
    initialAccountingActionState,
  );

  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardHeader>
        <CardTitle className="text-text">
          {initial.id ? "Editar categoría" : "Nueva categoría de egreso"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="expense-category-name">Nombre</Label>
            <Input
              id="expense-category-name"
              name="name"
              defaultValue={initial.name}
              placeholder="Ej.: Publicidad"
              aria-invalid={Boolean(state.fieldErrors.name)}
            />
            {state.fieldErrors.name ? (
              <p className="text-xs text-danger">{state.fieldErrors.name}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-category-color">Color del gráfico</Label>
            <div className="flex items-center gap-3">
              <input
                id="expense-category-color"
                name="color"
                type="color"
                defaultValue={initial.color ?? "#4F7A5A"}
                className="size-10 cursor-pointer rounded-lg border border-border bg-surface p-1"
              />
              <span className="text-xs text-text-muted">Se usa en el gráfico de egresos.</span>
            </div>
            {state.fieldErrors.color ? (
              <p className="text-xs text-danger">{state.fieldErrors.color}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-category-active">Estado</Label>
            <select
              id="expense-category-active"
              name="active"
              defaultValue={initial.active ? "true" : "false"}
              className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
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
            {pending ? "Guardando…" : "Guardar categoría"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
