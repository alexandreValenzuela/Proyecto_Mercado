import { z } from "zod";

const quantity = z.coerce
  .number()
  .int("La cantidad debe ser un número entero.")
  .min(1, "La cantidad mínima es 1.")
  .max(99, "La cantidad máxima por producto es 99.");

export const addToCartSchema = z.object({
  variantId: z.uuid("Elegí una variante válida."),
  quantity,
});

export const updateCartItemSchema = z.object({
  itemId: z.uuid("No se encontró el ítem del carrito."),
  quantity,
});

export const removeCartItemSchema = z.object({
  itemId: z.uuid("No se encontró el ítem del carrito."),
});

/** Esquema del formulario de cantidad (el id del ítem viaja aparte, desde la fila). */
export const cartQuantityFormSchema = z.object({ quantity: z.number().int().min(1).max(99) });

export type CartQuantityForm = z.infer<typeof cartQuantityFormSchema>;

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
