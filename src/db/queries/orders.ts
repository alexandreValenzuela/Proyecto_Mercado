import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  orderItems,
  orderStatusHistory,
  orders,
  storeSettings,
  users,
} from "@/db/schema";

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
