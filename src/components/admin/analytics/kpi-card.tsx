import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tone = "default" | "positive" | "negative" | "muted";

const VALUE_COLORS: Record<Tone, string> = {
  default: "text-text",
  positive: "text-primary",
  negative: "text-danger",
  muted: "text-text-muted",
};

export function KpiCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-text-muted">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-heading text-2xl font-bold ${VALUE_COLORS[tone]}`}>{value}</p>
        {detail ? <p className="mt-1 text-xs text-text-muted">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
