"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStockState, stockLabels } from "@/lib/catalog/stock";
import { formatMoney } from "@/lib/money";
import { addToCart } from "@/server/cart/actions";

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
  const [feedback, setFeedback] = useState<{
    status: "success" | "warning" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];
  const priceCents = selected?.priceCents ?? basePriceCents;
  const stock = selected?.stock ?? 0;
  const stockState = getStockState(stock, selected?.lowStockThreshold);

  const handleAdd = () => {
    if (!selected) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await addToCart(selected.id, quantity);
        if (response.message) {
          setFeedback({ status: response.status, text: response.message });
        }
        if (response.ok) {
          router.refresh();
        }
      } catch {
        setFeedback({
          status: "error",
          text: "No se pudo agregar el producto. Intentá de nuevo.",
        });
      }
    });
  };

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
                  setFeedback(null);
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

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={isPending || stockState === "out"}
        onClick={handleAdd}
      >
        {isPending ? "Agregando…" : stockState === "out" ? "Sin stock" : "Agregar al carrito"}
      </Button>

      {feedback ? (
        <p
          role={feedback.status === "error" ? "alert" : "status"}
          className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            feedback.status === "error"
              ? "bg-danger/10 text-danger"
              : feedback.status === "warning"
                ? "bg-warning/10 text-warning"
                : "bg-primary-soft text-primary"
          }`}
        >
          {feedback.text}
          {feedback.status === "success" ? (
            <Link href="/carrito" className="font-semibold underline underline-offset-2">
              Ver carrito
            </Link>
          ) : null}
        </p>
      ) : null}

      <p className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2 text-xs text-text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        El stock y el precio se confirman en el servidor antes de guardar el producto en tu carrito.
      </p>
    </div>
  );
}
