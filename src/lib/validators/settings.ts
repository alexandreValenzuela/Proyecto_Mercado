import { z } from "zod";

/** Los importes viajan como texto de centavos: el servidor los convierte a número. */
const centsString = z
  .string()
  .trim()
  .regex(/^\d+$/, "Ingresá un número entero mayor o igual a cero.")
  .refine((value) => Number.isSafeInteger(Number(value)), "El importe es demasiado grande.");

const optionalCentsString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.union([z.literal(""), centsString]),
);

export const storeSettingsFormSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre de la tienda.")
    .max(120, "El nombre no puede superar los 120 caracteres."),
  shippingFlatCents: centsString,
  // Vacío significa "sin umbral": se guarda como null.
  freeShippingThresholdCents: optionalCentsString,
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  pickupInstructions: z.string().trim().max(500, "El texto es demasiado largo.").optional(),
  contactEmail: z
    .union([z.string().email({ message: "Ingresá un email válido." }), z.literal("")])
    .optional(),
  contactWhatsapp: z.string().trim().max(80, "El texto es demasiado largo.").optional(),
});

export type StoreSettingsFormInput = z.infer<typeof storeSettingsFormSchema>;
