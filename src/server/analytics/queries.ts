/**
 * Consultas de dashboard y estadísticas: funciones puras que reciben un rango
 * de fechas y devuelven datos agregados. Cada función pública verifica el rol
 * admin además del proxy (`src/proxy.ts`).
 *
 * Reglas compartidas con contabilidad:
 * - Solo cuentan como ventas los pedidos `paid`, `preparing`, `shipped` y
 *   `delivered`, con `paid_at` como fecha contable.
 * - El día contable se calcula en SQL con `AT TIME ZONE
 *   'America/Argentina/Buenos_Aires'`.
 * - Los límites usan `-03:00` porque Argentina no tiene horario de verano.
 */
import { and, eq, exists, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  categories,
  orderItems,
  orders,
  productVariants,
  products,
  users,
} from "@/db/schema";
import { dayBoundary, todayInArgentina, type AccountingRange } from "@/lib/accounting/periods";
import { shiftDays, previousMonthToDate, previousRange, variationPercent } from "@/lib/analytics/periods";
import { requireAdmin } from "@/lib/auth/helpers";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/checkout/status";
import { INCOME_STATUSES } from "@/server/accounting/queries";
import type { SalesGranularity } from "@/lib/validators/analytics";

const DASHBOARD_SALES_DAYS = 30;
const TOP_LIMIT = 8;
const LOW_STOCK_LIMIT = 8;
const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

/** Un mismo objeto SQL se reutiliza en SELECT y GROUP BY: Drizzle bindea cada `sql` por separado. */
const DATE_KEY_SQL = new Map<SalesGranularity, SQL<string>>();

function dayKeySql(granularity: SalesGranularity): SQL<string> {
  const cached = DATE_KEY_SQL.get(granularity);
  if (cached) return cached;
  const pattern = granularity === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const expression = sql<string>`to_char(${orders.paidAt} AT TIME ZONE '${sql.raw(
    ARGENTINA_TZ,
  )}', '${sql.raw(pattern)}')`;
  DATE_KEY_SQL.set(granularity, expression);
  return expression;
}

function paidOrdersBetween(from: string, to: string): SQL {
  return and(
    inArray(orders.status, [...INCOME_STATUSES]),
    gte(orders.paidAt, dayBoundary(from, false)),
    lte(orders.paidAt, dayBoundary(to, true)),
  )!;
}

async function querySalesTotal(range: AccountingRange) {
  const rows = await getDb()
    .select({
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range.from, range.to));

  const totalCents = rows[0]?.totalCents ?? 0;
  const orderCount = rows[0]?.orderCount ?? 0;
  return {
    totalCents,
    orderCount,
    averageTicketCents: orderCount === 0 ? 0 : Math.round(totalCents / orderCount),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardKpis = {
  todaySalesCents: number;
  todayOrderCount: number;
  monthSalesCents: number;
  monthOrderCount: number;
  monthAverageTicketCents: number;
  previousMonthSalesCents: number;
  monthVariationPercent: number | null;
  pendingActionOrders: number;
  lowStockVariants: number;
};

/**
 * "Pendientes de acción" son pedidos ya pagados que esperan una transición del
 * admin (paid → preparing → shipped → delivered). `pending_payment` espera al
 * cliente y no entra en este KPI.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  await requireAdmin();

  const today = todayInArgentina();
  const monthRange: AccountingRange = {
    from: `${today.slice(0, 7)}-01`,
    to: today,
    label: "Mes en curso",
  };

  const [todaySales, monthSales, previousMonthSales, pendingRows, lowStockRows] =
    await Promise.all([
      querySalesTotal({ from: today, to: today, label: "Hoy" }),
      querySalesTotal(monthRange),
      querySalesTotal(previousMonthToDate(today)),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(inArray(orders.status, ["paid", "preparing", "shipped"])),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.active, true),
            lte(productVariants.stock, productVariants.lowStockThreshold),
          ),
        ),
    ]);

  return {
    todaySalesCents: todaySales.totalCents,
    todayOrderCount: todaySales.orderCount,
    monthSalesCents: monthSales.totalCents,
    monthOrderCount: monthSales.orderCount,
    monthAverageTicketCents: monthSales.averageTicketCents,
    previousMonthSalesCents: previousMonthSales.totalCents,
    monthVariationPercent: variationPercent(monthSales.totalCents, previousMonthSales.totalCents),
    pendingActionOrders: pendingRows[0]?.count ?? 0,
    lowStockVariants: lowStockRows[0]?.count ?? 0,
  };
}

export type LowStockRow = {
  variantId: string;
  productId: string;
  sku: string;
  variantLabel: string;
  productName: string;
  productSlug: string;
  stock: number;
  threshold: number;
};

export async function getLowStockVariants(limit = LOW_STOCK_LIMIT): Promise<LowStockRow[]> {
  await requireAdmin();

  return getDb()
    .select({
      variantId: productVariants.id,
      productId: products.id,
      sku: productVariants.sku,
      variantLabel: productVariants.label,
      productName: products.name,
      productSlug: products.slug,
      stock: productVariants.stock,
      threshold: productVariants.lowStockThreshold,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.active, true),
        lte(productVariants.stock, productVariants.lowStockThreshold),
      ),
    )
    .orderBy(
      sql`(${productVariants.stock} - ${productVariants.lowStockThreshold}) asc`,
      productVariants.stock,
    )
    .limit(Math.min(50, Math.max(1, limit)));
}

// ---------------------------------------------------------------------------
// Ventas por período y comparativa
// ---------------------------------------------------------------------------

export type SalesPoint = {
  key: string;
  label: string;
  totalCents: number;
  orderCount: number;
};

export type SalesComparisonPoint = SalesPoint & { previousTotalCents: number };

export type SalesComparison = {
  points: SalesComparisonPoint[];
  current: SalesPoint[];
  previous: SalesPoint[];
  totalCents: number;
  previousTotalCents: number;
  orderCount: number;
  previousOrderCount: number;
  averageTicketCents: number;
  previousAverageTicketCents: number;
  variationPercent: number | null;
};

type SaleBucket = { dateKey: string; totalCents: number; orderCount: number };

function bucketKeys(range: AccountingRange, granularity: SalesGranularity): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (let date = range.from; date <= range.to; date = shiftDays(date, 1)) {
    let key = date;
    if (granularity === "month") {
      key = date.slice(0, 7);
    } else if (granularity === "week") {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      key = shiftDays(date, weekday === 0 ? -6 : 1 - weekday);
    }
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

function bucketLabel(key: string, granularity: SalesGranularity): string {
  if (granularity === "month") {
    return new Intl.DateTimeFormat("es-AR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${key}-01T00:00:00Z`));
  }
  const short = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return granularity === "week" ? `Sem. ${short}` : short;
}

async function querySalesBuckets(
  range: AccountingRange,
  granularity: SalesGranularity,
): Promise<SaleBucket[]> {
  const dateExpression = dayKeySql(granularity);

  return getDb()
    .select({
      dateKey: dateExpression,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range.from, range.to))
    .groupBy(dateExpression);
}

function buildPoints(
  range: AccountingRange,
  granularity: SalesGranularity,
  buckets: SaleBucket[],
): SalesPoint[] {
  const byKey = new Map(buckets.map((bucket) => [bucket.dateKey, bucket]));
  return bucketKeys(range, granularity).map((key) => ({
    key,
    label: bucketLabel(key, granularity),
    totalCents: byKey.get(key)?.totalCents ?? 0,
    orderCount: byKey.get(key)?.orderCount ?? 0,
  }));
}

/** Compara el rango elegido contra el bloque inmediatamente anterior. */
export async function getSalesComparison(
  range: AccountingRange,
  granularity: SalesGranularity,
): Promise<SalesComparison> {
  await requireAdmin();
  const previous = previousRange(range);

  const [currentBuckets, previousBuckets, currentTotal, previousTotal] = await Promise.all([
    querySalesBuckets(range, granularity),
    querySalesBuckets(previous, granularity),
    querySalesTotal(range),
    querySalesTotal(previous),
  ]);

  const current = buildPoints(range, granularity, currentBuckets);
  const previousPoints = buildPoints(previous, granularity, previousBuckets);

  return {
    points: current.map((point, index) => ({
      ...point,
      previousTotalCents: previousPoints[index]?.totalCents ?? 0,
    })),
    current,
    previous: previousPoints,
    totalCents: currentTotal.totalCents,
    previousTotalCents: previousTotal.totalCents,
    orderCount: currentTotal.orderCount,
    previousOrderCount: previousTotal.orderCount,
    averageTicketCents: currentTotal.averageTicketCents,
    previousAverageTicketCents: previousTotal.averageTicketCents,
    variationPercent: variationPercent(currentTotal.totalCents, previousTotal.totalCents),
  };
}

/** Serie de los últimos 30 días corridos en hora Argentina (grafico del dashboard). */
export async function getLast30DaysSales(): Promise<SalesComparisonPoint[]> {
  await requireAdmin();
  const to = todayInArgentina();
  const from = shiftDays(to, -(DASHBOARD_SALES_DAYS - 1));
  const range: AccountingRange = {
    from,
    to,
    label: `Últimos ${DASHBOARD_SALES_DAYS} días`,
  };
  const previous = previousRange(range);

  const [currentBuckets, previousBuckets] = await Promise.all([
    querySalesBuckets(range, "day"),
    querySalesBuckets(previous, "day"),
  ]);
  const current = buildPoints(range, "day", currentBuckets);
  const previousPoints = buildPoints(previous, "day", previousBuckets);

  return current.map((point, index) => ({
    ...point,
    previousTotalCents: previousPoints[index]?.totalCents ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Desgloses de estadísticas
// ---------------------------------------------------------------------------

export type StatusCountRow = {
  status: OrderStatus;
  label: string;
  count: number;
  totalCents: number;
};

/** Los estados se cuentan por fecha de creación, no por fecha de pago. */
export async function getOrdersByStatus(range: AccountingRange): Promise<StatusCountRow[]> {
  await requireAdmin();

  const rows = await getDb()
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, dayBoundary(range.from, false)), lte(orders.createdAt, dayBoundary(range.to, true))))
    .groupBy(orders.status);

  const byStatus = new Map(rows.map((row) => [row.status, row]));
  return Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => {
    const status = value as OrderStatus;
    return {
      status,
      label,
      count: byStatus.get(status)?.count ?? 0,
      totalCents: byStatus.get(status)?.totalCents ?? 0,
    };
  });
}

export type ProductRankingRow = {
  productId: string;
  name: string;
  slug: string;
  units: number;
  revenueCents: number;
  costCents: number;
  grossMarginCents: number;
  missingCostUnits: number;
  incomplete: boolean;
};

/**
 * Incluye todos los productos activos, incluso los que no vendieron en el
 * período, para que "menor rotación" no esconda productos con cero ventas.
 */
export async function getProductRanking(range: AccountingRange): Promise<ProductRankingRow[]> {
  await requireAdmin();

  const quantity = sql<number>`case when ${orders.id} is not null then ${orderItems.quantity} else 0 end`;
  const rows = await getDb()
    .select({
      productId: products.id,
      name: products.name,
      slug: products.slug,
      units: sql<number>`coalesce(sum(${quantity}), 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${orderItems.unitPriceCents} * ${quantity}), 0)::int`,
      costCents: sql<number>`coalesce(sum(${orderItems.unitCostCents} * ${quantity}), 0)::int`,
      missingCostUnits: sql<number>`coalesce(sum(case when ${orders.id} is not null and ${orderItems.unitCostCents} is null then ${orderItems.quantity} else 0 end), 0)::int`,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(orderItems, eq(orderItems.variantId, productVariants.id))
    .leftJoin(orders, and(eq(orders.id, orderItems.orderId), paidOrdersBetween(range.from, range.to)))
    .where(eq(products.active, true))
    .groupBy(products.id, products.name, products.slug);

  return rows
    .map((row) => ({
      ...row,
      grossMarginCents: row.revenueCents - row.costCents,
      incomplete: row.missingCostUnits > 0,
    }))
    .sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, "es-AR"));
}

export type ProductRankings = {
  byUnits: ProductRankingRow[];
  byRevenue: ProductRankingRow[];
  lowestRotation: ProductRankingRow[];
};

export async function getProductRankings(range: AccountingRange): Promise<ProductRankings> {
  const ranking = await getProductRanking(range);
  return {
    byUnits: [...ranking].sort((a, b) => b.units - a.units).slice(0, TOP_LIMIT),
    byRevenue: [...ranking].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, TOP_LIMIT),
    lowestRotation: [...ranking].sort((a, b) => a.units - b.units).slice(0, TOP_LIMIT),
  };
}

export type CategorySalesRow = {
  categoryId: string;
  name: string;
  units: number;
  revenueCents: number;
  costCents: number;
  grossMarginCents: number;
  missingCostUnits: number;
  incomplete: boolean;
};

/** El margen por categoría usa los costos snapshot de cada ítem vendido. */
export async function getCategorySales(
  range: AccountingRange,
  limit = TOP_LIMIT,
): Promise<{ byUnits: CategorySalesRow[]; byMargin: CategorySalesRow[] }> {
  await requireAdmin();

  const rows = await getDb()
    .select({
      categoryId: categories.id,
      name: categories.name,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      revenueCents: sql<number>`coalesce(sum(${orderItems.unitPriceCents} * ${orderItems.quantity}), 0)::int`,
      costCents: sql<number>`coalesce(sum(${orderItems.unitCostCents} * ${orderItems.quantity}), 0)::int`,
      missingCostUnits: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orderItems.unitCostCents} is null), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(paidOrdersBetween(range.from, range.to))
    .groupBy(categories.id, categories.name);

  const mapped: CategorySalesRow[] = rows.map((row) => ({
    ...row,
    grossMarginCents: row.revenueCents - row.costCents,
    incomplete: row.missingCostUnits > 0,
  }));
  const capped = Math.min(50, Math.max(1, limit));

  return {
    byUnits: [...mapped].sort((a, b) => b.units - a.units).slice(0, capped),
    byMargin: [...mapped].sort((a, b) => b.grossMarginCents - a.grossMarginCents).slice(0, capped),
  };
}

export type PaymentMethodRow = {
  method: string;
  orderCount: number;
  totalCents: number;
};

export async function getPaymentMethods(range: AccountingRange): Promise<PaymentMethodRow[]> {
  await requireAdmin();

  return getDb()
    .select({
      method: sql<string>`coalesce(nullif(${orders.paymentMethod}, ''), 'Sin dato')`,
      orderCount: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range.from, range.to))
    .groupBy(sql`coalesce(nullif(${orders.paymentMethod}, ''), 'Sin dato')`)
    .orderBy(sql`count(*) desc`);
}

export type CustomerSegmentRow = {
  segment: "new" | "returning";
  label: string;
  orderCount: number;
  customerCount: number;
  totalCents: number;
};

/**
 * Un pedido es de cliente recurrente cuando ese usuario ya tenía otro pedido
 * pagado anterior (no solo dentro del período). La comparación se hace con
 * `paid_at` para respetar la misma regla que el resto de las ventas.
 */
export async function getCustomerSegments(range: AccountingRange): Promise<CustomerSegmentRow[]> {
  await requireAdmin();

  const previousOrders = alias(orders, "previous_orders");
  const hasPreviousOrder = exists(
    getDb()
      .select({ id: previousOrders.id })
      .from(previousOrders)
      .where(
        and(
          eq(previousOrders.userId, orders.userId),
          inArray(previousOrders.status, [...INCOME_STATUSES]),
          lt(previousOrders.paidAt, orders.paidAt),
        ),
      ),
  );

  const classified = getDb()
    .select({
      segment: sql<string>`case when ${hasPreviousOrder} then 'returning' else 'new' end`.as("segment"),
      userId: orders.userId,
      totalCents: orders.totalCents,
    })
    .from(orders)
    .where(paidOrdersBetween(range.from, range.to))
    .as("classified_orders");

  const rows = await getDb()
    .select({
      segment: classified.segment,
      orderCount: sql<number>`count(*)::int`,
      customerCount: sql<number>`count(distinct ${classified.userId})::int`,
      totalCents: sql<number>`coalesce(sum(${classified.totalCents}), 0)::int`,
    })
    .from(classified)
    .groupBy(classified.segment);

  const bySegment = new Map(rows.map((row) => [row.segment, row]));
  return [
    { segment: "new" as const, label: "Clientes nuevos" },
    { segment: "returning" as const, label: "Clientes recurrentes" },
  ].map(({ segment, label }) => ({
    segment,
    label,
    orderCount: bySegment.get(segment)?.orderCount ?? 0,
    customerCount: bySegment.get(segment)?.customerCount ?? 0,
    totalCents: bySegment.get(segment)?.totalCents ?? 0,
  }));
}

/** Cantidad total de clientes registrados (para contexto de los segmentos). */
export async function getRegisteredCustomerCount(): Promise<number> {
  await requireAdmin();

  const rows = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "customer"));
  return rows[0]?.count ?? 0;
}
