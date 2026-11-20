import { z } from "zod";

/** Los searchParams pueden llegar como string | string[] | undefined. */
function firstValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export const statsQuerySchema = z.object({
  period: z.preprocess(firstValue, z.enum(["day", "week", "month"]).default("month")),
  granularity: z.preprocess(firstValue, z.enum(["day", "week", "month"]).default("day")),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;

export type SalesGranularity = StatsQuery["granularity"];
