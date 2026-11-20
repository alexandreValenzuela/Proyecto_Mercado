"use client";

import { useState } from "react";
import { dismissCartMergeNotice } from "@/server/cart/actions";

/** Aviso de una sola vez: el usuario lo cierra y se limpia la cookie. */
export function CartMergeNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
      <p>No se pudo migrar toda la cantidad por stock disponible. Revisá los productos de tu carrito.</p>
      <button
        type="button"
        className="rounded-lg px-2 py-1 font-semibold underline underline-offset-2"
        onClick={() => {
          setVisible(false);
          void dismissCartMergeNotice().catch(() => {
            // Si no se puede limpiar, la cookie expira sola a los 10 minutos.
          });
        }}
      >
        Entendido
      </button>
    </div>
  );
}
