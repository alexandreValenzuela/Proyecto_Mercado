"use server";

import { and, eq, ilike, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { expenseCategories, expenses } from "@/db/schema";
import {
  accountingActionError,
  accountingActionSuccess,
  type AccountingActionState,
} from "@/lib/accounting/action-types";
import { AuthorizationError, requireAdmin } from "@/lib/auth/helpers";
import { parsePriceToCents } from "@/lib/money";
import {
  expenseCategoryIdSchema,
  expenseCategoryInputSchema,
  expenseIdSchema,
  expenseInputSchema,
} from "@/lib/validators/accounting";

type FieldErrors = Record<string, string>;

async function getAdminId(): Promise<string | null> {
  try {
    return (await requireAdmin()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null;
    }
    throw error;
  }
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalUuid(formData: FormData, key: string): string | undefined {
  const value = text(formData, key);
  return value === "" ? undefined : value;
}

function fieldErrorsFrom(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message;
  }
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "23505" || message.includes("duplicate key");
}

function revalidateAccounting(): void {
  revalidatePath("/admin/contabilidad");
  revalidatePath("/admin/contabilidad/egresos");
  revalidatePath("/admin/contabilidad/categorias");
}

export async function saveExpenseCategoryAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const adminId = await getAdminId();
  if (!adminId) {
    return accountingActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = expenseCategoryInputSchema.safeParse({
    id: optionalUuid(formData, "id"),
    name: text(formData, "name"),
    color: text(formData, "color"),
    active: text(formData, "active") === "true",
  });
  if (!parsed.success) {
    return accountingActionError(
      "Revisá los datos de la categoría.",
      fieldErrorsFrom(parsed.error),
    );
  }

  const input = parsed.data;
  const duplicate = await getDb()
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(
      and(
        ilike(expenseCategories.name, input.name),
        input.id ? ne(expenseCategories.id, input.id) : undefined,
      ),
    )
    .limit(1);
  if (duplicate.length > 0) {
    return accountingActionError("Ya existe una categoría con ese nombre.", {
      name: "Elegí otro nombre.",
    });
  }

  try {
    const values = { name: input.name, color: input.color, active: input.active };
    if (input.id) {
      const updated = await getDb()
        .update(expenseCategories)
        .set(values)
        .where(eq(expenseCategories.id, input.id))
        .returning({ id: expenseCategories.id });
      if (updated.length === 0) {
        return accountingActionError("No se encontró la categoría.");
      }
    } else {
      await getDb().insert(expenseCategories).values(values);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return accountingActionError("Ya existe una categoría con ese nombre.", {
        name: "Elegí otro nombre.",
      });
    }
    return accountingActionError("No se pudo guardar la categoría. Intentá de nuevo.");
  }

  revalidateAccounting();
  return accountingActionSuccess("Categoría guardada correctamente.");
}

export async function toggleExpenseCategoryActiveAction(formData: FormData): Promise<void> {
  const adminId = await getAdminId();
  if (!adminId) {
    return;
  }

  const parsed = expenseCategoryIdSchema.safeParse({
    categoryId: text(formData, "categoryId"),
  });
  if (!parsed.success) {
    return;
  }

  const [current] = await getDb()
    .select({ active: expenseCategories.active })
    .from(expenseCategories)
    .where(eq(expenseCategories.id, parsed.data.categoryId))
    .limit(1);
  if (!current) {
    return;
  }

  // Baja lógica: nunca se borra una categoría que pueda tener egresos asociados.
  await getDb()
    .update(expenseCategories)
    .set({ active: !current.active })
    .where(eq(expenseCategories.id, parsed.data.categoryId));

  revalidateAccounting();
}

export async function saveExpenseAction(
  _prev: AccountingActionState,
  formData: FormData,
): Promise<AccountingActionState> {
  const adminId = await getAdminId();
  if (!adminId) {
    return accountingActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = expenseInputSchema.safeParse({
    id: optionalUuid(formData, "id"),
    categoryId: text(formData, "categoryId"),
    description: text(formData, "description"),
    amount: text(formData, "amount"),
    expenseDate: text(formData, "expenseDate"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) {
    return accountingActionError("Revisá los datos del egreso.", fieldErrorsFrom(parsed.error));
  }

  const input = parsed.data;
  // El importe viaja como texto en pesos y se convierte a centavos acá.
  const amountCents = parsePriceToCents(input.amount);
  if (amountCents === null || amountCents <= 0) {
    return accountingActionError("El importe debe ser mayor a cero.", {
      amount: "Ingresá un importe mayor a cero.",
    });
  }

  const [category] = await getDb()
    .select({ id: expenseCategories.id, active: expenseCategories.active })
    .from(expenseCategories)
    .where(eq(expenseCategories.id, input.categoryId))
    .limit(1);
  if (!category) {
    return accountingActionError("La categoría elegida no existe.", {
      categoryId: "Elegí una categoría válida.",
    });
  }
  if (!category.active && !input.id) {
    return accountingActionError("Esa categoría está inactiva.", {
      categoryId: "Elegí una categoría activa.",
    });
  }

  const values = {
    categoryId: input.categoryId,
    description: input.description,
    amountCents,
    expenseDate: input.expenseDate,
    notes: input.notes || null,
  };

  try {
    if (input.id) {
      const updated = await getDb()
        .update(expenses)
        .set(values)
        .where(eq(expenses.id, input.id))
        .returning({ id: expenses.id });
      if (updated.length === 0) {
        return accountingActionError("No se encontró el egreso.");
      }
    } else {
      await getDb()
        .insert(expenses)
        .values({ ...values, createdBy: adminId });
    }
  } catch {
    return accountingActionError("No se pudo guardar el egreso. Intentá de nuevo.");
  }

  revalidateAccounting();
  return accountingActionSuccess("Egreso guardado correctamente.");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const adminId = await getAdminId();
  if (!adminId) {
    return;
  }

  const parsed = expenseIdSchema.safeParse({ expenseId: text(formData, "expenseId") });
  if (!parsed.success) {
    return;
  }

  await getDb().delete(expenses).where(eq(expenses.id, parsed.data.expenseId));
  revalidateAccounting();
}
