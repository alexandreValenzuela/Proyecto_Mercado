"use client";

import { useEffect } from "react";
import { StatusCard } from "@/components/feedback/status-card";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusCard
      code="Error"
      title="Algo salió mal"
      description="No pudimos cargar esta página. Probá de nuevo; si el problema continúa, volvé más tarde."
      action={<Button onClick={reset}>Reintentar</Button>}
    />
  );
}
