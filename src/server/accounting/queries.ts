/**
 * Consultas contables puras: reciben un rango de fechas y devuelven datos ya
 * agregados. Ningún componente ejecuta SQL; todas verifican el rol admin.
 *
 * Los ingresos NO se cargan a mano: se derivan de pedidos pagados usando
 * `paid_at` como fecha contable. Se excluyen `cancelled` y `pending_payment`.
 */
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { expenseCategories, expenses, orderItems, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { dayBoundary, type AccountingRange } from "@/lib/accounting/periods";

/** Estados que cuentan como venta; compartido con `src/server/analytics`. */
export const INCOME_STATUSES = ["paid", "preparing", "shipped", "delivered"] as const;
export const ACCOUNTING_MOVEMENT_LIMIT = 500;
const MAX_EXPENSES = 300;

export type AccountingBalance = {
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  orderCount: number;
  expenseCount: number;
};

export type CostOfSales = {
  salesCents: number;
  costCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
  soldItems: number;
  missingCostItems: number;
  incomplete: boolean;
};

export type ExpenseCategorySummary = {
  id: string;
  name: string;
  color: string | null;
  totalCents: number;
  expenseCount: number;
};

export type AccountingMovement = {
  id: string;
  dateKey: string;
  kind: "income" | "expense";
  description: string;
  categoryName: string | null;
  amountCents: number;
  orderId: string | null;
  expenseId: string | null;
};

export type ExpenseWithCategory = {
  id: string;
  categoryId: string;
  categoryName: string | null;
  categoryColor: string | null;
  description: string;
  amountCents: number;
  expenseDate: string;
  notes: string | null;
  isDemo: boolean;
};

export type ExpenseCategoryRow = {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  expenseCount: number;
};

function paidOrdersInRange(range: AccountingRange): SQL {
  return and(
    inArray(orders.status, [...INCOME_STATUSES]),
    gte(orders.paidAt, dayBoundary(range.from, false)),
    lte(orders.paidAt, dayBoundary(range.to, true)),
  )!;
}

function expensesInRange(range: AccountingRange): SQL {
  return and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to))!;
}

async function queryBalance(range: AccountingRange): Promise<AccountingBalance> {
  const [incomeRows, expenseRows] = await Promise.all([
    getDb()
      .select({
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .where(paidOrdersInRange(range)),
    getDb()
      .select({
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
      })
      .from(expenses)
      .where(expensesInRange(range)),
  ]);

  const incomeCents = incomeRows[0]?.totalCents ?? 0;
  const expenseCents = expenseRows[0]?.totalCents ?? 0;
  return {
    incomeCents,
    expenseCents,
    resultCents: incomeCents - expenseCents,
    orderCount: incomeRows[0]?.count ?? 0,
    expenseCount: expenseRows[0]?.count ?? 0,
  };
}

export async function getAccountingBalance(range: AccountingRange): Promise<AccountingBalance> {
  await requireAdmin();
  return queryBalance(range);
}

/**
 * Margen bruto = ingresos - costo de ventas. Si algún ítem vendido no tiene
 * costo, el resultado se marca como incompleto en lugar de asumir costo 0.
 */
export async function getCostOfSales(range: AccountingRange): Promise<CostOfSales> {
  await requireAdmin();

  const [balance, costRows] = await Promise.all([
    queryBalance(range),
    getDb()
      .select({
        costCents: sql<number>`coalesce(sum(${orderItems.unitCostCents} * ${orderItems.quantity}), 0)::int`,
        soldItems: sql<number>`count(*)::int`,
        missingCostItems: sql<number>`count(*) filter (where ${orderItems.unitCostCents} is null)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(paidOrdersInRange(range)),
  ]);

  const costCents = costRows[0]?.costCents ?? 0;
  const grossMarginCents = balance.incomeCents - costCents;
  const missingCostItems = costRows[0]?.missingCostItems ?? 0;

  return {
    salesCents: balance.incomeCents,
    costCents,
    grossMarginCents,
    grossMarginPercent:
      balance.incomeCents === 0 ? 0 : (grossMarginCents / balance.incomeCents) * 100,
    soldItems: costRows[0]?.soldItems ?? 0,
    missingCostItems,
    incomplete: missingCostItems > 0,
  };
}

export async function getExpensesByCategory(
  range: AccountingRange,
): Promise<ExpenseCategorySummary[]> {
  await requireAdmin();

  return getDb()
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      color: expenseCategories.color,
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
      expenseCount: sql<number>`count(${expenses.id})::int`,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(expensesInRange(range))
    .groupBy(expenseCategories.id, expenseCategories.name, expenseCategories.color)
    .orderBy(desc(sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`));
}

/**
 * Movimientos unificados. La fecha de los ingresos se calcula en SQL con
 * `AT TIME ZONE`, para que el día contable sea el de Argentina y no el UTC.
 */
export async function getUnifiedMovements(
  range: AccountingRange,
  sort: "date-asc" | "date-desc",
): Promise<AccountingMovement[]> {
  await requireAdmin();

  const incomeRows = getDb()
    .select({
      id: orders.id,
      dateKey: sql<string>`to_char(${orders.paidAt} AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')`,
      description: sql<string>`'Pedido #' || lpad(${orders.number}::text, 4, '0')`,
      categoryName: sql<string | null>`null::text`,
      amountCents: orders.totalCents,
      orderId: orders.id,
      expenseId: sql<string | null>`null::uuid`,
    })
    .from(orders)
    .where(paidOrdersInRange(range));

  const expenseRows = getDb()
    .select({
      id: expenses.id,
      dateKey: expenses.expenseDate,
      description: expenses.description,
      categoryName: expenseCategories.name,
      amountCents: expenses.amountCents,
      orderId: sql<string | null>`null::uuid`,
      expenseId: expenses.id,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(expensesInRange(range));

  const [income, outgoing] = await Promise.all([incomeRows, expenseRows]);
  const movements: AccountingMovement[] = [
    ...income.map((row) => ({
      ...row,
      kind: "income" as const,
      orderId: row.orderId,
      expenseId: null,
    })),
    ...outgoing.map((row) => ({
      ...row,
      kind: "expense" as const,
      orderId: null,
      expenseId: row.expenseId,
    })),
  ];

  const direction = sort === "date-asc" ? 1 : -1;
  movements.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey < b.dateKey ? -direction : direction;
    }
    if (a.kind !== b.kind) {
      return a.kind === "income" ? -direction : direction;
    }
    return a.description.localeCompare(b.description, "es-AR");
  });

  return movements.slice(0, ACCOUNTING_MOVEMENT_LIMIT);
}

export async function listExpenses(): Promise<ExpenseWithCategory[]> {
  await requireAdmin();

  const rows = await getDb()
    .select({
      id: expenses.id,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      categoryColor: expenseCategories.color,
      description: expenses.description,
      amountCents: expenses.amountCents,
      expenseDate: expenses.expenseDate,
      notes: expenses.notes,
      isDemo: expenses.isDemo,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(MAX_EXPENSES);

  return rows;
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  await requireAdmin();

  return getDb()
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      color: expenseCategories.color,
      active: expenseCategories.active,
      expenseCount: sql<number>`count(${expenses.id})::int`,
    })
    .from(expenseCategories)
    .leftJoin(expenses, eq(expenses.categoryId, expenseCategories.id))
    .groupBy(
      expenseCategories.id,
      expenseCategories.name,
      expenseCategories.color,
      expenseCategories.active,
    )
    .orderBy(asc(expenseCategories.name));
}
