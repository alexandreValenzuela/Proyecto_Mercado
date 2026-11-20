"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

export type MarketBarDatum = { label: string; value: number };

/** Barras horizontales reutilizables para provincias, ciudades, días y franjas. */
export function MarketBarChart({
  data,
  valueLabel = "Pedidos",
  format = "count",
  axisWidth = 120,
}: {
  data: MarketBarDatum[];
  valueLabel?: string;
  format?: "count" | "money";
  axisWidth?: number;
}) {
  if (data.length === 0 || data.every((point) => point.value === 0)) {
    return (
      <p className="py-16 text-center text-sm text-text-muted">
        No hay datos para este gráfico en el período elegido.
      </p>
    );
  }

  return (
    <div className="h-64 w-full" aria-label={valueLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={format === "money" ? (value: number) => formatMoney(value) : undefined}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={axisWidth}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) =>
              format === "money"
                ? formatMoney(Number(value))
                : `${numberFormat.format(Number(value))} ${valueLabel.toLowerCase()}`
            }
          />
          <Bar dataKey="value" name={valueLabel} fill="var(--primary)" isAnimationActive={false} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const numberFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
