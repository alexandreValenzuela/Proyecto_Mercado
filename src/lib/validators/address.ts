import { z } from "zod";
import { ARGENTINE_PROVINCES } from "@/lib/provinces";

/** Dirección completa; se usa tanto en alta/edición como en el checkout. */
export const addressInputSchema = z.object({
  recipientName: z.string().trim().min(2, "Ingresá el nombre de quien recibe.").max(100),
  phone: z.string().trim().min(6, "Ingresá un teléfono válido.").max(30),
  street: z.string().trim().min(2, "Ingresá la calle.").max(120),
  number: z.string().trim().min(1, "Ingresá el número.").max(20),
  floorApt: z.string().trim().max(30).nullable().optional(),
  city: z.string().trim().min(2, "Ingresá la ciudad.").max(100),
  province: z.enum(ARGENTINE_PROVINCES, { error: "Elegí una provincia válida." }),
  postalCode: z.string().trim().min(4, "Ingresá el código postal.").max(10),
  notes: z.string().trim().max(300).nullable().optional(),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
/** Tipo de entrada del formulario: `isDefault` puede venir sin definir. */
export type AddressFormInput = z.input<typeof addressInputSchema>;
