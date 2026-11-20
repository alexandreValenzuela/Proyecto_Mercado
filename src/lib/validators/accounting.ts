import { z } from "zod";

/** searchParams pueden llegar como string | string[] | undefined. */
function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

const dateString = z.preprocess(
  firstValue,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá el formato AAAA-MM-DD.")
    .optional(),
);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const accountingPeriodQuerySchema = z
  .object({
    period: z.preprocess(
      firstValue,
      z.enum(["day", "week", "month", "year", "custom"]).default("month"),
    ),
    from: dateString,
    to: dateString,
    sort: z.preprocess(firstValue, z.enum(["date-asc", "date-desc"]).default("date-desc")),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "La fecha desde no puede ser mayor a la fecha hasta.",
    path: ["from"],
  });

export type AccountingPeriodQuery = z.infer<typeof accountingPeriodQuerySchema>;

export const expenseCategoryInputSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(80, "El nombre es demasiado largo."),
  color: z
    .string()
    .trim()
    .refine((value) => value === "" || HEX_COLOR.test(value), {
      message: "Usá un color hexadecimal, por ejemplo #4F7A5A.",
    })
    .default("")
    .transform((value) => (value === "" ? null : value)),
  active: z.boolean(),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>;

export const expenseCategoryIdSchema = z.object({
  categoryId: z.uuid("La categoría no es válida."),
});

export const expenseInputSchema = z.object({
  id: z.uuid().optional(),
  categoryId: z.uuid("Elegí una categoría válida."),
  description: z
    .string()
    .trim()
    .min(2, "La descripción debe tener al menos 2 caracteres.")
    .max(160, "La descripción es demasiado larga."),
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Ingresá un importe válido, por ejemplo 12500.50."),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Usá el formato AAAA-MM-DD."),
  notes: z.string().trim().max(1000, "Las notas son demasiado largas.").default(""),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseIdSchema = z.object({
  expenseId: z.uuid("El egreso no es válido."),
});
