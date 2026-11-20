import { z } from "zod";

/** searchParams pueden llegar como string | string[] | undefined. */
function firstValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

const optionalText = z.preprocess(firstValue, z.string().trim().optional());
export const catalogQuerySchema = z.object({
  q: z.preprocess(firstValue, z.string().trim().max(100).default("")),
  category: z.preprocess(firstValue, z.string().trim().max(100).default("")),
  // Se guardan como texto (pesos) y se convierten a centavos en la capa de dominio.
  min: optionalText,
  max: optionalText,
  sort: z.preprocess(
    firstValue,
    z.enum(["relevance", "price-asc", "price-desc", "newest", "best-selling"]).default("relevance"),
  ),
  page: z.preprocess(firstValue, z.coerce.number().int().positive().max(1000).default(1)),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

/** Query ya normalizada: los precios de texto se convirtieron a centavos. */
export type CatalogResolvedQuery = Omit<CatalogQuery, "min" | "max"> & {
  min?: number;
  max?: number;
};

export const adminProductQuerySchema = catalogQuerySchema.extend({
  active: z.preprocess(
    firstValue,
    z.enum(["all", "active", "inactive"]).default("all"),
  ),
});

export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;

export type AdminResolvedQuery = Omit<AdminProductQuery, "min" | "max"> & {
  min?: number;
  max?: number;
};

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1, "El SKU es obligatorio.").max(64),
  label: z.string().trim().min(1, "La etiqueta es obligatoria.").max(120),
  attributes: z.record(z.string(), z.string()).default({}),
  priceCents: z.number().int().nonnegative().nullable().default(null),
  costCents: z.number().int().nonnegative().nullable().default(null),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(3),
  active: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof variantInputSchema>;

export const productImageInputSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.url(),
  publicId: z.string().trim().max(255).nullable().default(null),
  position: z.number().int().nonnegative().default(0),
});

export const productInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo admite letras minúsculas, números y guiones.")
    .max(160),
  description: z.string().trim().max(4000).default(""),
  categoryId: z.uuid("Elegí una categoría válida."),
  basePriceCents: z.number().int().nonnegative("El precio base no puede ser negativo."),
  costCents: z.number().int().nonnegative().nullable().default(null),
  active: z.boolean().default(true),
  variants: z.array(variantInputSchema).min(1, "Cargá al menos una variante."),
  images: z.array(productImageInputSchema).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo admite letras minúsculas, números y guiones.")
    .max(100),
  parentId: z.uuid().nullable().default(null),
  position: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const stockAdjustmentSchema = z.object({
  variantId: z.uuid(),
  delta: z
    .number()
    .int()
    .refine((value) => value !== 0, "El ajuste no puede ser cero."),
  reason: z.enum(["restock", "adjustment"]),
  note: z.string().trim().max(500).default(""),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const productViewSchema = z.object({
  productId: z.uuid(),
});

export const productImageUploadSchema = z.object({
  productId: z.uuid(),
  url: z.url(),
  publicId: z.string().trim().min(1).max(255),
  position: z.number().int().nonnegative().default(0),
});
