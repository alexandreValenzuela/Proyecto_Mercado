import { z } from "zod";
import { orderStatusEnum } from "@/db/schema";

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

export const adminOrderQuerySchema = z.object({
  status: z.preprocess(
    firstValue,
    z.enum(["all", ...orderStatusEnum.enumValues]).default("all"),
  ),
  from: dateString,
  to: dateString,
  q: z.preprocess(firstValue, z.string().trim().max(100).default("")),
  page: z.preprocess(firstValue, z.coerce.number().int().positive().max(1000).default(1)),
});

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

/** Estados que el administrador puede setear a mano (el alta a `paid` la hace el webhook). */
export const adminNextStatusSchema = z.enum(["preparing", "shipped", "delivered"], {
  error: "Elegí una transición válida.",
});

export const changeOrderStatusSchema = z.object({
  orderId: z.uuid("El pedido no es válido."),
  toStatus: adminNextStatusSchema,
});

export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;

export const cancelOrderSchema = z.object({
  orderId: z.uuid("El pedido no es válido."),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
