"use client";

import { useEffect } from "react";

/** Registra la visita en el servidor; la cookie httpOnly se crea en el route handler. */
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/product-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      signal: controller.signal,
    }).catch(() => {
      // Una visita fallida no debe romper la página de producto.
    });

    return () => controller.abort();
  }, [productId]);

  return null;
}
