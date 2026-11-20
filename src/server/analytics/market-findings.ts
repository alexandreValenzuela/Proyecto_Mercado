/**
 * Reglas deterministas de hallazgos: toman datos ya agregados y devuelven
 * frases en español rioplatense con sus números de respaldo. Sin base de datos,
 * sin sesión y sin azar: el mismo input produce siempre el mismo output.
 */
import { formatMoney } from "@/lib/money";
import type {
  MarketFunnel,
  MarketLocationRow,
  MarketTimeBucketRow,
  MarketWeekdayRow,
  RepeatCustomerSummary,
  ViewedVsPurchasedRow,
} from "@/server/analytics/market";

export type MarketFindingTone = "info" | "good" | "attention";

export type MarketFinding = {
  id: string;
  tone: MarketFindingTone;
  message: string;
  detail: string;
};

export type MarketFindingsInput = {
  rangeLabel: string;
  provinces: MarketLocationRow[];
  pickup: MarketLocationRow | null;
  weekdays: MarketWeekdayRow[];
  buckets: MarketTimeBucketRow[];
  funnel: MarketFunnel;
  abandoned: { count: number; estimatedValueCents: number; olderThanHours: number };
  viewedVsPurchased: ViewedVsPurchasedRow[];
  repeat: RepeatCustomerSummary;
};

const numberFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function rateText(rate: number | null): string {
  return rate === null ? "sin base de comparación" : `${numberFormat.format(rate)} %`;
}

function share(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Reglas simples, ordenadas por relevancia para el estudio de GAO. */
export function buildMarketFindings(input: MarketFindingsInput): MarketFinding[] {
  const findings: MarketFinding[] = [];
  const totalSalesCents =
    input.provinces.reduce((sum, row) => sum + row.totalCents, 0) + (input.pickup?.totalCents ?? 0);

  if (totalSalesCents <= 0 || input.funnel.paidOrders === 0) {
    findings.push({
      id: "no-sales",
      tone: "attention",
      message: "Todavía no hay ventas pagadas en el período elegido.",
      detail: `Cuando ${input.rangeLabel.toLowerCase()} tenga pedidos pagados, acá vas a ver los patrones de compra.`,
    });
    return findings;
  }

  const topProvince = input.provinces[0];
  if (topProvince) {
    const provinceShare = share(topProvince.totalCents, totalSalesCents);
    findings.push({
      id: "top-province",
      tone: "info",
      message: `La provincia ${topProvince.label} concentra el ${rateText(provinceShare)} de las ventas.`,
      detail: `${topProvince.orderCount} pedidos y ${formatMoney(topProvince.totalCents)} sobre ${formatMoney(
        totalSalesCents,
      )} del período.`,
    });
  } else if (input.pickup) {
    findings.push({
      id: "only-pickup",
      tone: "info",
      message: "Todas las ventas del período fueron en retiro en persona.",
      detail: `${input.pickup.orderCount} pedidos por ${formatMoney(input.pickup.totalCents)} sin dirección de envío.`,
    });
  }

  if (input.pickup && input.pickup.orderCount > 0) {
    const pickupShare = share(input.pickup.orderCount, input.funnel.paidOrders);
    if (pickupShare !== null && pickupShare >= 15) {
      findings.push({
        id: "pickup-share",
        tone: "info",
        message: `El retiro en persona representa el ${rateText(pickupShare)} de los pedidos pagados.`,
        detail: `${input.pickup.orderCount} retiros por ${formatMoney(input.pickup.totalCents)}.`,
      });
    }
  }

  if (input.funnel.paidOrders < 5) {
    findings.push({
      id: "sparse-orders",
      tone: "attention",
      message: "Todavía hay muy pocos pedidos para identificar días o franjas pico.",
      detail: `Solo ${input.funnel.paidOrders} pedidos pagados en ${input.rangeLabel.toLowerCase()}.`,
    });
  } else {
    const peakWeekday = [...input.weekdays].filter((day) => day.orderCount > 0).sort((a, b) => b.orderCount - a.orderCount || a.isoDay - b.isoDay)[0];
    if (peakWeekday) {
      findings.push({
        id: "peak-weekday",
        tone: "info",
        message: `El ${peakWeekday.label} es el día con más ventas.`,
        detail: `${peakWeekday.orderCount} pedidos (${rateText(
          share(peakWeekday.orderCount, input.funnel.paidOrders),
        )}) y ${formatMoney(peakWeekday.totalCents)}.`,
      });
    }

    const peakBucket = [...input.buckets].filter((slot) => slot.orderCount > 0).sort((a, b) => b.orderCount - a.orderCount || a.bucket - b.bucket)[0];
    if (peakBucket) {
      findings.push({
        id: "peak-time",
        tone: "info",
        message: `La franja ${peakBucket.label} concentra la mayor cantidad de compras.`,
        detail: `${peakBucket.orderCount} pedidos (${rateText(
          share(peakBucket.orderCount, input.funnel.paidOrders),
        )}) y ${formatMoney(peakBucket.totalCents)}.`,
      });
    }
  }

  if (input.funnel.views < 10) {
    findings.push({
      id: "sparse-views",
      tone: "attention",
      message: "Todavía hay pocas visitas para medir conversión por producto.",
      detail: `${input.funnel.views} vistas de producto en ${input.rangeLabel.toLowerCase()}.`,
    });
  } else {
    const lowConversion = [...input.viewedVsPurchased]
      .sort((a, b) => b.views - a.views)
      .find((row) => row.views >= 3 && (row.conversionPercent ?? 0) <= 20);
    if (lowConversion) {
      findings.push({
        id: "low-conversion",
        tone: "attention",
        message: `El producto ${lowConversion.name} tiene ${lowConversion.views} visitas y solo ${lowConversion.purchaseCount} compras.`,
        detail: `Conversión del ${rateText(lowConversion.conversionPercent)}. Conviene revisar precio y descripción.`,
      });
    } else {
      findings.push({
        id: "conversion-ok",
        tone: "good",
        message: "No apareció ningún producto con muchas visitas y baja conversión.",
        detail: "Ningún producto con al menos 3 visitas bajó del 20 % de conversión en el período.",
      });
    }
  }

  if (input.abandoned.count > 0) {
    findings.push({
      id: "abandoned-carts",
      tone: "attention",
      message: `Hay ${numberFormat.format(input.abandoned.count)} carritos abandonados hace más de ${input.abandoned.olderThanHours} horas.`,
      detail: `Valor estimado: ${formatMoney(input.abandoned.estimatedValueCents)} a precios actuales, sin contar envío.`,
    });
  } else {
    findings.push({
      id: "no-abandoned-carts",
      tone: "good",
      message: "No hay carritos abandonados con más de un día de inactividad.",
      detail: "Los carritos con ítems tienen actividad reciente o ya generaron un pedido.",
    });
  }

  if (input.repeat.totalCustomers < 3) {
    findings.push({
      id: "sparse-customers",
      tone: "attention",
      message: "Todavía no hay suficientes clientes para analizar recompra.",
      detail: `${input.repeat.totalCustomers} clientes con pedidos pagados hasta el final del período.`,
    });
  } else {
    findings.push({
      id: "repeat-rate",
      tone: "info",
      message: `El ${rateText(input.repeat.repeatRatePercent)} de los clientes compró más de una vez.`,
      detail: `Promedio de ${numberFormat.format(
        input.repeat.averageOrdersPerCustomer,
      )} compras y ${formatMoney(input.repeat.averageValueCentsPerCustomer)} por cliente.`,
    });
  }

  return findings;
}
