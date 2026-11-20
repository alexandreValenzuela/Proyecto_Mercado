import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatusCardProps = {
  code: string;
  title: string;
  description: string;
  action: ReactNode;
};

export function StatusCard({ code, title, description, action }: StatusCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12 sm:px-6">
      <Card className="w-full max-w-md border-border bg-surface text-center shadow-sm">
        <CardHeader className="items-center gap-3">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {code}
          </span>
          <CardTitle className="font-heading text-2xl text-primary">{title}</CardTitle>
          <CardDescription className="text-text-muted">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">{action}</CardContent>
      </Card>
    </main>
  );
}
