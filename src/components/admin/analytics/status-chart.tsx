"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OrderStatus } from "@/lib/checkout/status";

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: "var(--warning)",
  paid: "var(--primary)",
  preparing: "var(--chart-3)",
  shipped: "var(--chart-4)",
  delivered: "var(--primary)",
  cancelled: "var(--danger)",
};

export type StatusChartPoint = { status: OrderStatus; label: string; count: number };

export function StatusChart({ data }: { data: StatusChartPoint[] }) {
  if (data.every((point) => point.count === 0)) {
    return (
      <p className="py-16 text-center text-sm text-text-muted">
        No hay pedidos creados en el período elegido.
      </p>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="Pedidos por estado">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={112}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(value) => `${Number(value)} pedidos`} />
          <Bar dataKey="count" name="Pedidos" isAnimationActive={false}>
            {data.map((point) => (
              <Cell key={point.status} fill={STATUS_COLORS[point.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
