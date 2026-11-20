"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStockState, stockLabels } from "@/lib/catalog/stock";
import { formatMoney } from "@/lib/money";

export type PurchaseVariant = {
  id: string;
  sku: string;
  label: string;
  attributes: Record<string, string>;
  priceCents: number | null;
  stock: number;
  lowStockThreshold: number;
};

export function ProductPurchasePanel({
  basePriceCents,
  variants,
}: {
  basePriceCents: number;
  variants: PurchaseVariant[];
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
  const priceCents = selected?.priceCents ?? basePriceCents;
  const stock = selected?.stock ?? 0;
  const stockState = getStockState(stock, selected?.lowStockThreshold);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-text-muted">Precio</p>
        <p className="font-heading text-3xl font-extrabold text-primary">{formatMoney(priceCents)}</p>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          variant={stockState === "out" ? "destructive" : stockState === "low" ? "default" : "secondary"}
          className={stockState === "low" ? "bg-accent text-text" : undefined}
        >
          {stockLabels[stockState]}
        </Badge>
        {stockState !== "out" ? (
          <span className="text-sm text-text-muted">{stock} unidades disponibles</span>
        ) : null}
      </div>

      {variants.length > 0 ? (
        <div className="space-y-2">
          <Label>Variante</Label>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => {
                  setSelectedId(variant.id);
                  setQuantity(1);
                }}
                aria-pressed={variant.id === selected?.id}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  variant.id === selected?.id
                    ? "border-primary bg-primary-soft font-semibold text-primary"
                    : "border-border bg-surface text-text hover:border-primary"
                }`}
              >
                {variant.label}
                {variant.stock <= 0 ? " (sin stock)" : ""}
              </button>
            ))}
          </div>
          {selected && Object.keys(selected.attributes).length > 0 ? (
            <p className="text-xs text-text-muted">
              {Object.entries(selected.attributes)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="product-quantity">Cantidad</Label>
        <Input
          id="product-quantity"
          type="number"
          min={1}
          max={Math.max(1, stock)}
          value={quantity}
          disabled={stockState === "out"}
          onChange={(event) => {
            const next = Number(event.target.value);
            setQuantity(Number.isFinite(next) ? Math.max(1, Math.min(Math.max(1, stock), next)) : 1);
          }}
          className="w-24"
        />
      </div>

      {/* Fase 4: acá se conectará la acción real del carrito. Hoy no persiste nada. */}
      <Button type="button" size="lg" className="w-full" disabled>
        {stockState === "out" ? "Sin stock" : "Agregar al carrito"}
      </Button>
      <p className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2 text-xs text-text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        El carrito se habilita en la próxima fase. Por ahora podés explorar el catálogo y los
        detalles de cada producto.
      </p>
    </div>
  );
}
