import { formatPeriodDate, type AccountingRange } from "@/lib/accounting/periods";

/** Utilidades de período puras: ninguna depende de la sesión ni de la base. */

export function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Bloque inmediatamente anterior, de la misma cantidad de días. */
export function previousRange(range: AccountingRange): AccountingRange {
  const length = daysBetween(range.from, range.to);
  const from = shiftDays(range.from, -length);
  const to = shiftDays(range.from, -1);

  return {
    from,
    to,
    label: `Período anterior: ${formatPeriodDate(from)} al ${formatPeriodDate(to)}`,
  };
}

/** Mes anterior con el mismo corte de días que el mes en curso (month-to-date). */
export function previousMonthToDate(today: string): AccountingRange {
  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = cursor.getUTCFullYear();
  const previousMonth = cursor.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  const to = `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(
    Math.min(day, lastDay),
  ).padStart(2, "0")}`;
  const from = `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;

  return {
    from,
    to,
    label: `Mes anterior: ${formatPeriodDate(from)} al ${formatPeriodDate(to)}`,
  };
}

/** null = sin base de comparación (el período anterior no tuvo ventas). */
export function variationPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}
