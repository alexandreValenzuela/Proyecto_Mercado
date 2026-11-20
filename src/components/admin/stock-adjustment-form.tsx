"use client";

import { useRouter } from "next/navigation";
import { useEffect, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialCatalogActionState } from "@/lib/catalog/action-types";
import { adjustStockAction } from "@/server/admin/products";

type StockVariant = { id: string; sku: string; label: string; stock: number };

export function StockAdjustmentForm({ variants }: { variants: StockVariant[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(adjustStockAction, initialCatalogActionState);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState<"restock" | "adjustment">("adjustment");
  const [note, setNote] = useState("");
  const selected = variants.find((variant) => variant.id === variantId);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  const payload = JSON.stringify({
    variantId,
    delta: Number(delta),
    reason,
    note,
  });

  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardHeader>
        <CardTitle className="text-text">Ajustar stock</CardTitle>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <p className="text-sm text-text-muted">Este producto no tiene variantes activas.</p>
        ) : (
          <form action={formAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="payload" value={payload} />
            <div className="space-y-1.5">
              <Label htmlFor="stock-variant">Variante</Label>
              <select
                id="stock-variant"
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label} ({variant.sku}) · {variant.stock} u.
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-delta">Ajuste (+ o -)</Label>
              <Input
                id="stock-delta"
                type="number"
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-reason">Motivo</Label>
              <select
                id="stock-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as "restock" | "adjustment")}
                className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
              >
                <option value="restock">Reposición</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-note">Nota (opcional)</Label>
              <Input
                id="stock-note"
                maxLength={500}
                placeholder="Ej.: corrección de inventario"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Registrando…" : "Registrar ajuste"}
              </Button>
            </div>
            {state.message ? (
              <p
                role="status"
                className={`sm:col-span-2 rounded-xl px-3 py-2 text-xs ${
                  state.status === "error" ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"
                }`}
              >
                {state.message}
              </p>
            ) : null}
            {selected ? (
              <p className="text-xs text-text-muted sm:col-span-2">
                Stock actual de {selected.sku}: {selected.stock} unidades.
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
