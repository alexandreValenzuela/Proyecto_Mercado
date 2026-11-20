/**
 * Consultas del estudio de mercado. Funciones puras: reciben rangos explícitos,
 * no leen sesión, cookies ni headers, y devuelven datos serializables.
 * La autorización se aplica en el límite de la página (`requireAdmin`).
 *
 * Convenciones compartidas con contabilidad y estadísticas:
 * - Ventas = pedidos `paid`, `preparing`, `shipped` y `delivered`, con
 *   `paid_at` como fecha contable; se excluyen `cancelled` y `pending_payment`.
 * - Los límites del rango usan `-03:00` (Argentina no tiene horario de verano).
 * - Todo agrupamiento por día/hora se hace con `AT TIME ZONE
 *   'America/Argentina/Buenos_Aires'`.
 */
import { and, eq, gte, inArray, lte, notExists, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cartItems,
  carts,
  orderItems,
  orders,
  productVariants,
  products,
  productViews,
  users,
} from "@/db/schema";
import type { PgColumn } from "drizzle-orm/pg-core";
import { dayBoundary, type AccountingRange } from "@/lib/accounting/periods";
import { INCOME_STATUSES } from "@/server/accounting/queries";

const PICKUP_LABEL = "Retiro en persona";
const ABANDONED_LIMIT_HOURS = 24;
const VIEWED_VS_PURCHASED_LIMIT = 8;

/**
 * Un mismo objeto SQL se reutiliza en SELECT y GROUP BY: Drizzle bindea cada
 * plantilla por separado y Postgres rechazaría dos parámetros distintos.
 */
const PROVINCE_KEY_SQL = sql<string>`case when ${orders.shippingMethod} = 'pickup' then '${sql.raw(
  PICKUP_LABEL,
)}' else coalesce(nullif(${orders.shippingAddress}->>'province', ''), 'Sin provincia') end`;
const CITY_KEY_SQL = sql<string>`case when ${orders.shippingMethod} = 'pickup' then '${sql.raw(
  PICKUP_LABEL,
)}' else coalesce(nullif(${orders.shippingAddress}->>'city', ''), 'Sin ciudad') end`;
const WEEKDAY_KEY_SQL = sql<number>`extract(isodow from (${orders.paidAt} at time zone 'America/Argentina/Buenos_Aires'))::int`;
const HOUR_BUCKET_KEY_SQL = sql<number>`floor(extract(hour from (${orders.paidAt} at time zone 'America/Argentina/Buenos_Aires')) / 4)::int`;
const CART_ACTIVITY_SQL = sql<string>`to_char(${carts.updatedAt} at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')`;

function paidOrdersBetween(range: AccountingRange): SQL {
  return and(
    inArray(orders.status, [...INCOME_STATUSES]),
    gte(orders.paidAt, dayBoundary(range.from, false)),
    lte(orders.paidAt, dayBoundary(range.to, true)),
  )!;
}

function between(column: PgColumn, range: AccountingRange): SQL {
  return and(gte(column, dayBoundary(range.from, false)), lte(column, dayBoundary(range.to, true)))!;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function averageCents(totalCents: number, count: number): number {
  return count <= 0 ? 0 : Math.round(totalCents / count);
}

function sortByAmount(a: MarketLocationRow, b: MarketLocationRow): number {
  return b.totalCents - a.totalCents || b.orderCount - a.orderCount || a.label.localeCompare(b.label, "es-AR");
}

// ---------------------------------------------------------------------------
 // Compras por provincia y ciudad
 // ---------------------------------------------------------------------------

export type MarketLocationRow = {
  label: string;
  orderCount: number;
  totalCents: number;
  averageTicketCents: number;
};

export type MarketGeography = {
  provinces: MarketLocationRow[];
  cities: MarketLocationRow[];
  pickup: MarketLocationRow | null;
};

async function queryLocations(key: SQL<string>, range: AccountingRange): Promise<MarketLocationRow[]> {
  const rows = await getDb()
    .select({
      label: key,
      orderCount: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range))
    .groupBy(key);

  return rows
    .map((row) => ({
      ...row,
      averageTicketCents: averageCents(row.totalCents, row.orderCount),
    }))
    .sort(sortByAmount);
}

/** El retiro en persona se separa: no tiene provincia ni ciudad de envío. */
export async function getMarketGeography(range: AccountingRange): Promise<MarketGeography> {
  const [provinceRows, cityRows] = await Promise.all([
    queryLocations(PROVINCE_KEY_SQL, range),
    queryLocations(CITY_KEY_SQL, range),
  ]);
  const pickup =
    provinceRows.find((row) => row.label === PICKUP_LABEL) ??
    cityRows.find((row) => row.label === PICKUP_LABEL) ??
    null;

  return {
    provinces: provinceRows.filter((row) => row.label !== PICKUP_LABEL),
    cities: cityRows.filter((row) => row.label !== PICKUP_LABEL),
    pickup,
  };
}

// ---------------------------------------------------------------------------
 // Día de la semana y franja horaria
 // ---------------------------------------------------------------------------

export type MarketWeekdayRow = {
  isoDay: number;
  label: string;
  orderCount: number;
  totalCents: number;
};

export type MarketTimeBucketRow = {
  bucket: number;
  label: string;
  orderCount: number;
  totalCents: number;
};

export type MarketHeatmapCell = {
  isoDay: number;
  bucket: number;
  orderCount: number;
};

export type MarketTiming = {
  weekdays: MarketWeekdayRow[];
  buckets: MarketTimeBucketRow[];
  heatmap: MarketHeatmapCell[];
};

export const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const TIME_BUCKET_LABELS = ["00–03 h", "04–07 h", "08–11 h", "12–15 h", "16–19 h", "20–23 h"] as const;

type WeekdayBucket = { isoDay: number; orderCount: number; totalCents: number };
type HourBucket = { bucket: number; orderCount: number; totalCents: number };

/** Devuelve los siete días completos, aunque no tengan ventas. */
export async function getMarketTiming(range: AccountingRange): Promise<MarketTiming> {
  const weekdayRows: WeekdayBucket[] = await getDb()
    .select({
      isoDay: WEEKDAY_KEY_SQL,
      orderCount: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range))
    .groupBy(WEEKDAY_KEY_SQL);

  const hourRows: HourBucket[] = await getDb()
    .select({
      bucket: HOUR_BUCKET_KEY_SQL,
      orderCount: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range))
    .groupBy(HOUR_BUCKET_KEY_SQL);

  const heatmapRows = await getDb()
    .select({
      isoDay: WEEKDAY_KEY_SQL,
      bucket: HOUR_BUCKET_KEY_SQL,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(paidOrdersBetween(range))
    .groupBy(WEEKDAY_KEY_SQL, HOUR_BUCKET_KEY_SQL);

  const weekdaysByDay = new Map(weekdayRows.map((row) => [row.isoDay, row]));
  const hoursByBucket = new Map(hourRows.map((row) => [row.bucket, row]));

  const weekdays = WEEKDAY_LABELS.map((label, index) => {
    const isoDay = index + 1;
    const row = weekdaysByDay.get(isoDay);
    return {
      isoDay,
      label,
      orderCount: row?.orderCount ?? 0,
      totalCents: row?.totalCents ?? 0,
    };
  });

  const buckets = TIME_BUCKET_LABELS.map((label, bucket) => {
    const row = hoursByBucket.get(bucket);
    return {
      bucket,
      label,
      orderCount: row?.orderCount ?? 0,
      totalCents: row?.totalCents ?? 0,
    };
  });

  const cellsByKey = new Map(heatmapRows.map((row) => [`${row.isoDay}-${row.bucket}`, row.orderCount]));
  const heatmap: MarketHeatmapCell[] = [];
  for (const day of weekdays) {
    for (const slot of buckets) {
      heatmap.push({
        isoDay: day.isoDay,
        bucket: slot.bucket,
        orderCount: cellsByKey.get(`${day.isoDay}-${slot.bucket}`) ?? 0,
      });
    }
  }

  return { weekdays, buckets, heatmap };
}

// ---------------------------------------------------------------------------
 // Embudo de conversión
 // ---------------------------------------------------------------------------

export type FunnelStep = {
  id: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
  rateFromStart: number | null;
};

export type MarketFunnel = {
  steps: FunnelStep[];
  views: number;
  carts: number;
  createdOrders: number;
  paidOrders: number;
};

/** Los carritos y pedidos se cuentan por fecha de creación; las visitas, por fecha de visita. */
export async function getConversionFunnel(range: AccountingRange): Promise<MarketFunnel> {
  const viewRange = between(productViews.createdAt, range);
  const cartRange = between(carts.createdAt, range);
  const orderRange = between(orders.createdAt, range);

  const [viewRows, cartRows, createdRows, paidRows] = await Promise.all([
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(productViews)
      .where(viewRange),
    getDb()
      .select({ count: sql<number>`count(distinct ${carts.id})::int` })
      .from(carts)
      .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .where(cartRange),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(orderRange),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(paidOrdersBetween(range)),
  ]);

  const views = viewRows[0]?.count ?? 0;
  const cartsWithItems = cartRows[0]?.count ?? 0;
  const createdOrders = createdRows[0]?.count ?? 0;
  const paidOrders = paidRows[0]?.count ?? 0;
  const values = [views, cartsWithItems, createdOrders, paidOrders];
  const definitions: Array<{ id: string; label: string }> = [
    { id: "views", label: "Vistas de producto" },
    { id: "carts", label: "Carritos con ítems" },
    { id: "created", label: "Pedidos creados" },
    { id: "paid", label: "Pedidos pagados" },
  ];

  return {
    steps: definitions.map((definition, index) => ({
      ...definition,
      count: values[index],
      rateFromPrevious: index === 0 ? null : percentage(values[index], values[index - 1]),
      rateFromStart: index === 0 ? (views > 0 ? 100 : null) : percentage(values[index], views),
    })),
    views,
    carts: cartsWithItems,
    createdOrders,
    paidOrders,
  };
}

// ---------------------------------------------------------------------------
 // Abandono de carrito
 // ---------------------------------------------------------------------------

export type AbandonedCartRow = {
  cartId: string;
  owner: string;
  itemCount: number;
  estimatedValueCents: number;
  lastActivity: string;
  isDemo: boolean;
};

export type AbandonedCarts = {
  count: number;
  estimatedValueCents: number;
  rows: AbandonedCartRow[];
  olderThanHours: number;
};

/**
 * Se considera abandonado un carrito con ítems sin movimientos en 24 horas y
 * sin pedido posterior a su última actividad. Los carritos de invitado no
 * pueden vincularse a un pedido, por eso siempre entran en el conteo.
 * El valor es una estimación con precios vigentes, no un total facturado.
 */
export async function getAbandonedCarts(
  asOf: Date,
  olderThanHours = ABANDONED_LIMIT_HOURS,
): Promise<AbandonedCarts> {
  const hours = Math.max(1, Math.floor(olderThanHours));
  const cutoff = new Date(asOf.getTime() - hours * 3_600_000);
  const hasLaterOrder = notExists(
    getDb()
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.userId, carts.userId), gte(orders.createdAt, carts.updatedAt))),
  );

  const rows = await getDb()
    .select({
      cartId: carts.id,
      ownerName: users.name,
      isDemo: sql<boolean>`coalesce(${users.isDemo}, false)`,
      lastActivity: CART_ACTIVITY_SQL,
      itemCount: sql<number>`count(${cartItems.id})::int`,
      estimatedValueCents: sql<number>`coalesce(sum(${cartItems.quantity} * coalesce(${productVariants.priceCents}, ${products.basePriceCents})), 0)::int`,
    })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(users, eq(users.id, carts.userId))
    .where(and(lte(carts.updatedAt, cutoff), hasLaterOrder))
    .groupBy(carts.id, carts.updatedAt, users.name, users.isDemo)
    .orderBy(sql`${carts.updatedAt} asc`);

  const mapped: AbandonedCartRow[] = rows.map((row) => ({
    cartId: row.cartId,
    owner: row.ownerName ?? "Invitado",
    itemCount: row.itemCount,
    estimatedValueCents: row.estimatedValueCents,
    lastActivity: row.lastActivity,
    isDemo: row.isDemo === true,
  }));

  return {
    count: mapped.length,
    estimatedValueCents: mapped.reduce((sum, row) => sum + row.estimatedValueCents, 0),
    rows: mapped,
    olderThanHours: hours,
  };
}

// ---------------------------------------------------------------------------
 // Visitados vs. comprados
 // ---------------------------------------------------------------------------

export type ViewedVsPurchasedRow = {
  productId: string;
  name: string;
  slug: string;
  views: number;
  purchaseCount: number;
  units: number;
  conversionPercent: number | null;
};

/** Productos activos con visitas en el período, ordenados por brecha visitas/compras. */
export async function getViewedVsPurchased(
  range: AccountingRange,
  limit = VIEWED_VS_PURCHASED_LIMIT,
): Promise<ViewedVsPurchasedRow[]> {
  const viewRows = await getDb()
    .select({
      productId: productViews.productId,
      views: sql<number>`count(*)::int`,
    })
    .from(productViews)
    .where(between(productViews.createdAt, range))
    .groupBy(productViews.productId);

  const purchaseRows = await getDb()
    .select({
      productId: productVariants.productId,
      purchaseCount: sql<number>`count(distinct ${orders.id})::int`,
      units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(paidOrdersBetween(range))
    .groupBy(productVariants.productId);

  const productRows = await getDb()
    .select({ id: products.id, name: products.name, slug: products.slug })
    .from(products)
    .where(eq(products.active, true));

  const viewsByProduct = new Map(viewRows.map((row) => [row.productId, row.views]));
  const purchasesByProduct = new Map(purchaseRows.map((row) => [row.productId, row]));
  const capped = Math.min(50, Math.max(1, limit));

  return productRows
    .filter((product) => (viewsByProduct.get(product.id) ?? 0) > 0)
    .map((product) => {
      const views = viewsByProduct.get(product.id) ?? 0;
      const purchaseCount = purchasesByProduct.get(product.id)?.purchaseCount ?? 0;
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        views,
        purchaseCount,
        units: purchasesByProduct.get(product.id)?.units ?? 0,
        conversionPercent: percentage(purchaseCount, views),
      };
    })
    .sort(
      (a, b) =>
        b.views - b.purchaseCount - (a.views - a.purchaseCount) ||
        b.views - a.views ||
        a.name.localeCompare(b.name, "es-AR"),
    )
    .slice(0, capped);
}

// ---------------------------------------------------------------------------
 // Recompra y valor por cliente
 // ---------------------------------------------------------------------------

export type CustomerSegment = {
  label: string;
  customerCount: number;
  orderCount: number;
  totalCents: number;
};

export type RepeatCustomerSummary = {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatRatePercent: number | null;
  averageOrdersPerCustomer: number;
  averageValueCentsPerCustomer: number;
  segments: CustomerSegment[];
};

/**
 * Recurrente = dos o más pedidos pagados hasta el final del período, sin
 * importar cuándo los hizo. "Nuevo" = un solo pedido pagado en ese corte.
 */
export async function getRepeatCustomers(range: AccountingRange): Promise<RepeatCustomerSummary> {
  const rows = await getDb()
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*)::int`,
      totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, [...INCOME_STATUSES]),
        lte(orders.paidAt, dayBoundary(range.to, true)),
      ),
    )
    .groupBy(orders.userId);

  const returning = rows.filter((row) => row.orderCount >= 2);
  const single = rows.filter((row) => row.orderCount === 1);
  const totalCustomers = rows.length;
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);

  const segments: CustomerSegment[] = [
    {
      label: "Nuevos (1 compra)",
      customerCount: single.length,
      orderCount: single.reduce((sum, row) => sum + row.orderCount, 0),
      totalCents: single.reduce((sum, row) => sum + row.totalCents, 0),
    },
    {
      label: "Recurrentes (2 o más)",
      customerCount: returning.length,
      orderCount: returning.reduce((sum, row) => sum + row.orderCount, 0),
      totalCents: returning.reduce((sum, row) => sum + row.totalCents, 0),
    },
  ];

  return {
    totalCustomers,
    newCustomers: single.length,
    returningCustomers: returning.length,
    repeatRatePercent: percentage(returning.length, totalCustomers),
    averageOrdersPerCustomer:
      totalCustomers === 0 ? 0 : Math.round((totalOrders / totalCustomers) * 100) / 100,
    averageValueCentsPerCustomer: averageCents(totalCents, totalCustomers),
    segments,
  };
}
