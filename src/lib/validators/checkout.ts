import { z } from "zod";
import { addressInputSchema } from "@/lib/validators/address";

const checkoutBaseSchema = z.object({
  shippingMethod: z.enum(["delivery", "pickup"], {
    error: "Elegí envío a domicilio o retiro.",
  }),
  addressId: z.uuid().nullable().optional(),
  newAddress: addressInputSchema.nullable().optional(),
});

function requireDeliveryAddress(
  value: { shippingMethod: "delivery" | "pickup"; addressId?: string | null; newAddress?: unknown },
  ctx: z.RefinementCtx,
): void {
  if (value.shippingMethod === "delivery" && !value.addressId && !value.newAddress) {
    ctx.addIssue({
      code: "custom",
      path: ["addressId"],
      message: "Elegí una dirección guardada o cargá una nueva.",
    });
  }
}

/** Datos que el servidor acepta para crear un pedido. Los importes nunca viajan. */
export const createCheckoutSchema = checkoutBaseSchema.superRefine(requireDeliveryAddress);
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

/**
 * Formulario: `selectedAddress` es el id de una dirección guardada o el literal
 * "new". El servidor vuelve a validar todo con `createCheckoutSchema`.
 */
export const checkoutFormSchema = z
  .object({
    shippingMethod: z.enum(["delivery", "pickup"], {
      error: "Elegí envío a domicilio o retiro.",
    }),
    selectedAddress: z.string().min(1, "Elegí una dirección guardada o cargá una nueva."),
    newAddress: addressInputSchema.partial().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.shippingMethod === "delivery" && value.selectedAddress === "new") {
      const parsed = addressInputSchema.safeParse(value.newAddress);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["newAddress", ...issue.path],
            message: issue.message,
          });
        }
      }
    }
  });

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export const checkoutResultStatusSchema = z.enum(["approved", "pending", "failure"]);
