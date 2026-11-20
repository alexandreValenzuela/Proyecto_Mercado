import type { AccountingPeriodQuery } from "@/lib/validators/accounting";

/**
 * Períodos contables en hora de Argentina. El negocio no usa horario de verano
 * desde 2011, así que los límites -03:00 son válidos para todo el año.
 * El agrupamiento dentro de SQL se hace con `AT TIME ZONE` (ver queries.ts).
 */
export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_OFFSET = "-03:00";

export type AccountingRange = {
  from: string;
  to: string;
  label: string;
};

export function todayInArgentina(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function startOfWeek(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** Etiqueta originaria de una fecha AAAA-MM-DD, sin correr el día por UTC. */
export function formatPeriodDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export function resolveAccountingPeriod(query: AccountingPeriodQuery): AccountingRange {
  const today = todayInArgentina();

  switch (query.period) {
    case "day":
      return { from: today, to: today, label: `Hoy, ${formatPeriodDate(today)}` };
    case "week": {
      const from = startOfWeek(today);
      return {
        from,
        to: today,
        label: `Semana del ${formatPeriodDate(from)} al ${formatPeriodDate(today)}`,
      };
    }
    case "year":
      return {
        from: `${today.slice(0, 4)}-01-01`,
        to: today,
        label: `Año ${today.slice(0, 4)}`,
      };
    case "custom": {
      const from = query.from ?? today;
      const to = query.to ?? today;
      if (from > to) {
        return { from: to, to: from, label: "Rango personalizado" };
      }
      return {
        from,
        to,
        label: `Del ${formatPeriodDate(from)} al ${formatPeriodDate(to)}`,
      };
    }
    case "month":
    default:
      return {
        from: `${today.slice(0, 7)}-01`,
        to: today,
        label: `Mes de ${formatPeriodDate(today).slice(3)}`,
      };
  }
}

/** Límites inclusivos como timestamptz para filtrar `paid_at`. */
export function dayBoundary(date: string, endOfDay: boolean): Date {
  return new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00"}${ARGENTINA_OFFSET}`);
}
