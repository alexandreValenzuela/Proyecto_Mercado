"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

export type SalesChartPoint = {
  label: string;
  totalCents: number;
  previousTotalCents: number;
};

export function SalesChart({
  data,
  previousLabel = "Período anterior",
}: {
  data: SalesChartPoint[];
  previousLabel?: string;
}) {
  if (data.every((point) => point.totalCents === 0 && point.previousTotalCents === 0)) {
    return (
      <p className="py-16 text-center text-sm text-text-muted">
        Todavía no hay ventas registradas para este gráfico.
      </p>
    );
  }

  return (
    <div className="h-72 w-full sm:h-80" aria-label="Ventas por período">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            width={100}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickFormatter={(value: number) => formatMoney(value)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(value) => formatMoney(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="previousTotalCents"
            name={previousLabel}
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.1}
            strokeDasharray="5 4"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="totalCents"
            name="Este período"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
