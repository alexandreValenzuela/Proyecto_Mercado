"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryPayment } from "@/server/checkout/actions";

/** Genera una preferencia nueva sobre el MISMO pedido pendiente. */
export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            try {
              const result = await retryPayment({ orderId });
              if (!result.ok) {
                setFeedback(result.message ?? "No se pudo reintentar el pago. Intentá de nuevo.");
                return;
              }
              if (result.checkoutUrl) {
                window.location.assign(result.checkoutUrl);
                return;
              }
              setFeedback("No se pudo reintentar el pago. Intentá de nuevo.");
            } catch {
              setFeedback("No se pudo reintentar el pago. Recargá la página e intentá de nuevo.");
            }
          });
        }}
      >
        <RotateCcw aria-hidden />
        {isPending ? "Generando el pago…" : "Reintentar pago"}
      </Button>
      {feedback ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
