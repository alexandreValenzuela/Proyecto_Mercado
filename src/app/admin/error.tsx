"use client";

import { useEffect } from "react";
import { StatusCard } from "@/components/feedback/status-card";
import { Button } from "@/components/ui/button";

/** Cubre dashboard, estadísticas y el resto del panel con una acción de reintento. */
export default function AdminErrorBoundary({
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
      <StatusCard
        code="Error"
        title="No pudimos cargar el panel"
        description="Revisá tu conexión e intentá de nuevo. Si el problema continúa, avisá al administrador del sistema."
        action={<Button onClick={reset}>Reintentar</Button>}
      />
    </main>
  );
}
