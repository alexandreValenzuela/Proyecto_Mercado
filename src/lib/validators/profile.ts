import { z } from "zod";

/** Datos que el cliente puede editar de su propia cuenta. */
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ingresá tu nombre.")
    .max(120, "El nombre no puede superar los 120 caracteres."),
  phone: z.string().trim().max(40, "El teléfono no puede superar los 40 caracteres.").optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
