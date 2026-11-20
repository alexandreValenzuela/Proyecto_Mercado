import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orderItems,
  orderStatusHistory,
  orders,
  productVariants,
  stockMovementReasonEnum,
  stockMovements,
  storeSettings,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { hasManualReview, type OrderStatus } from "@/lib/checkout/status";
import type { AdminOrderQuery } from "@/lib/validators/admin-orders";

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderStatusRow = typeof orderStatusHistory.$inferSelect;
export type StoreSettingsRow = typeof storeSettings.$inferSelect;

export async function getStoreSettings(): Promise<StoreSettingsRow | null> {
  const rows = await getDb().select().from(storeSettings).limit(1);
  return rows[0] ?? null;
}

export async function listOrdersForUser(userId: string): Promise<OrderRow[]> {
  return getDb()
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(200);
}

export async function findOrderForUser(userId: string, orderId: string): Promise<OrderRow | null> {
  const rows = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findOrderById(orderId: string): Promise<OrderRow | null> {
  const rows = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string): Promise<OrderItemRow[]> {
  return getDb().select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusRow[]> {
  return getDb()
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(orderStatusHistory.createdAt);
}

/** Datos del pagador para prellenar la preferencia de MercadoPago. */
export async function getOrderPayerEmail(orderId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ email: users.email })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  return rows[0]?.email ?? null;
}

// ---------------------------------------------------------------------------
// Panel de administración (Fase 6)
// ---------------------------------------------------------------------------

export type AdminOrderListRow = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: Date;
  totalCents: number;
  paymentMethod: string | null;
  mpStatus: string | null;
  shippingMethod: OrderRow["shippingMethod"];
  manualReview: boolean;
  customerName: string;
  customerEmail: string;
};

export type AdminOrderHistoryRow = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string | null;
  changedByName: string | null;
  createdAt: Date;
};

export type AdminOrderMovementRow = {
  id: string;
  delta: number;
  reason: (typeof stockMovementReasonEnum.enumValues)[number];
  note: string | null;
  createdAt: Date;
  sku: string | null;
};

export type AdminOrderDetail = {
  order: OrderRow & { customerName: string; customerEmail: string };
  items: OrderItemRow[];
  history: AdminOrderHistoryRow[];
  movements: AdminOrderMovementRow[];
};

/** Escapa comodines para que el texto libre no cambie el patrón ILIKE. */
function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

/** Argentina no usa horario de verano desde 2011: -03:00 es la zona del negocio. */
function dayBoundary(date: string, endOfDay: boolean): Date {
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00"}-03:00`);
}

export async function listAdminOrders(
  filters: AdminOrderQuery,
  pageSize: number,
): Promise<{ items: AdminOrderListRow[]; total: number }> {
  await requireAdmin();

  const conditions: SQL[] = [];
  if (filters.status !== "all") {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.from) {
    conditions.push(gte(orders.createdAt, dayBoundary(filters.from, false)));
  }
  if (filters.to) {
    conditions.push(lte(orders.createdAt, dayBoundary(filters.to, true)));
  }
  if (filters.q) {
    const term = likeTerm(filters.q);
    conditions.push(
      or(
        ilike(sql<string>`${orders.number}::text`, term),
        ilike(users.email, term),
        ilike(users.name, term),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, counts] = await Promise.all([
    getDb()
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        createdAt: orders.createdAt,
        totalCents: orders.totalCents,
        paymentMethod: orders.paymentMethod,
        mpStatus: orders.mpStatus,
        shippingMethod: orders.shippingMethod,
        customerName: users.name,
        customerEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.number))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .where(where),
  ]);
  return {
    items: rows.map((row) => ({ ...row, manualReview: hasManualReview(row.mpStatus) })),
    total: counts[0]?.count ?? 0,
  };
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  await requireAdmin();

  const rows = await getDb()
    .select({
      order: orders,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const [items, history, movements] = await Promise.all([
    getOrderItems(orderId),
    getDb()
      .select({
        id: orderStatusHistory.id,
        fromStatus: orderStatusHistory.fromStatus,
        toStatus: orderStatusHistory.toStatus,
        changedBy: orderStatusHistory.changedBy,
        changedByName: users.name,
        createdAt: orderStatusHistory.createdAt,
      })
      .from(orderStatusHistory)
      .leftJoin(users, eq(orderStatusHistory.changedBy, users.id))
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt), asc(orderStatusHistory.id)),
    getDb()
      .select({
        id: stockMovements.id,
        delta: stockMovements.delta,
        reason: stockMovements.reason,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
        sku: productVariants.sku,
      })
      .from(stockMovements)
      .leftJoin(productVariants, eq(stockMovements.variantId, productVariants.id))
      .where(eq(stockMovements.orderId, orderId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(100),
  ]);

  return {
    order: { ...row.order, customerName: row.customerName, customerEmail: row.customerEmail },
    items,
    history,
    movements,
  };
}
