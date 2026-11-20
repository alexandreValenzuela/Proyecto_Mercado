import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { addresses, orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import type { OrderStatus } from "@/lib/checkout/status";

/** Mismo criterio de ingreso que contabilidad, estadísticas y mercado. */
const INCOME_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const;

export type AdminCustomerListRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isDemo: boolean;
  createdAt: Date;
  orderCount: number;
  totalSpentCents: number;
};

export type AdminCustomerDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isDemo: boolean;
    createdAt: Date;
  };
  addresses: Array<{
    id: string;
    recipientName: string;
    phone: string;
    street: string;
    number: string;
    floorApt: string | null;
    city: string;
    province: string;
    postalCode: string;
    notes: string | null;
    isDefault: boolean;
  }>;
  orders: Array<{
    id: string;
    number: number;
    status: OrderStatus;
    totalCents: number;
    paidAt: Date | null;
    createdAt: Date;
  }>;
};

/** Escapa comodines para que el texto libre no cambie el patrón ILIKE. */
function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function listAdminCustomers(input: {
  query?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: AdminCustomerListRow[]; total: number }> {
  await requireAdmin();

  const conditions: SQL[] = [eq(users.role, "customer")];
  if (input.query) {
    const term = likeTerm(input.query);
    conditions.push(or(ilike(users.name, term), ilike(users.email, term))!);
  }
  const where = and(...conditions);
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));

  // Agregamos aparte para no multiplicar filas de usuarios al hacer el join.
  const incomeByCustomer = getDb()
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*)::int`.as("order_count"),
      totalSpentCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`.as(
        "total_spent_cents",
      ),
    })
    .from(orders)
    .where(inArray(orders.status, [...INCOME_STATUSES]))
    .groupBy(orders.userId)
    .as("income_by_customer");

  const [rows, counts] = await Promise.all([
    getDb()
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        isDemo: users.isDemo,
        createdAt: users.createdAt,
        orderCount: sql<number>`coalesce(${incomeByCustomer.orderCount}, 0)::int`,
        totalSpentCents: sql<number>`coalesce(${incomeByCustomer.totalSpentCents}, 0)::int`,
      })
      .from(users)
      .leftJoin(incomeByCustomer, eq(incomeByCustomer.userId, users.id))
      .where(where)
      .orderBy(
        desc(sql`coalesce(${incomeByCustomer.totalSpentCents}, 0)`),
        asc(users.name),
        asc(users.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);

  return { items: rows, total: counts[0]?.count ?? 0 };
}

export async function getAdminCustomerDetail(customerId: string): Promise<AdminCustomerDetail | null> {
  await requireAdmin();

  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isDemo: users.isDemo,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, customerId), eq(users.role, "customer")))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return null;
  }

  const [customerAddresses, customerOrders] = await Promise.all([
    getDb()
      .select({
        id: addresses.id,
        recipientName: addresses.recipientName,
        phone: addresses.phone,
        street: addresses.street,
        number: addresses.number,
        floorApt: addresses.floorApt,
        city: addresses.city,
        province: addresses.province,
        postalCode: addresses.postalCode,
        notes: addresses.notes,
        isDefault: addresses.isDefault,
      })
      .from(addresses)
      .where(eq(addresses.userId, customerId))
      .orderBy(desc(addresses.isDefault), asc(addresses.city), asc(addresses.id)),
    getDb()
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalCents: orders.totalCents,
        paidAt: orders.paidAt,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, customerId))
      .orderBy(desc(orders.createdAt), desc(orders.number))
      .limit(200),
  ]);

  return { user, addresses: customerAddresses, orders: customerOrders };
}
