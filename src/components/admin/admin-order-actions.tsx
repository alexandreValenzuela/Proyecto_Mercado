"use client";

import { AlertTriangle, ArrowRight, Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/checkout/status";
import {
  cancelOrderAction,
  changeOrderStatusAction,
  type AdminOrderActionResult,
} from "@/server/admin/orders";

type Props = {
  orderId: string;
  status: string;
  nextStatuses: OrderStatus[];
  canCancel: boolean;
};

export function AdminOrderActions({ orderId, status, nextStatuses, canCancel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<AdminOrderActionResult | null>(null);

  function run(action: () => Promise<AdminOrderActionResult>): void {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {nextStatuses.map((next) => (
          <Button
            key={next}
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => changeOrderStatusAction({ orderId, toStatus: next }))
            }
          >
            <ArrowRight aria-hidden />
            Pasar a {ORDER_STATUS_LABELS[next]}
          </Button>
        ))}
        {canCancel ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => run(() => cancelOrderAction({ orderId }))}
          >
            <Ban aria-hidden />
            Cancelar pedido
          </Button>
        ) : null}
        {nextStatuses.length === 0 && !canCancel ? (
          <p className="text-sm text-text-muted">
            El pedido está {ORDER_STATUS_LABELS[status as OrderStatus] ?? "en un estado final"} y no
            tiene acciones disponibles.
          </p>
        ) : null}
      </div>

      {feedback ? (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            feedback.ok ? "bg-primary-soft text-primary" : "bg-danger/10 text-danger"
          }`}
        >
          {feedback.ok ? null : <AlertTriangle className="size-4" aria-hidden />}
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
