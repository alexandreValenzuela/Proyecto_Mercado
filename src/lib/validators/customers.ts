import { z } from "zod";

/** searchParams pueden llegar como string | string[] | undefined. */
function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export const adminCustomerQuerySchema = z.object({
  q: z.preprocess(firstValue, z.string().trim().max(100).optional()),
  page: z.preprocess(firstValue, z.coerce.number().int().positive().max(1000).default(1)),
});

export type AdminCustomerQuery = z.infer<typeof adminCustomerQuerySchema>;
