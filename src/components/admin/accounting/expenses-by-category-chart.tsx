"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/money";

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ExpensesByCategoryChart({
  data,
}: {
  data: Array<{ id: string; name: string; totalCents: number; color: string | null }>;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        Todavía no hay egresos en este período.
      </p>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="Egresos por categoría">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="totalCents"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            isAnimationActive={false}
          >
            {data.map((item, index) => (
              <Cell
                key={item.id}
                fill={item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatMoney(Number(value))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
