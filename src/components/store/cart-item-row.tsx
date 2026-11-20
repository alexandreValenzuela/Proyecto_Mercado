"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CartSummaryItem } from "@/lib/cart/types";
import { formatMoney } from "@/lib/money";
import {
  cartQuantityFormSchema,
  type CartQuantityForm,
} from "@/lib/validators/cart";
import { removeCartItem, updateCartItem } from "@/server/cart/actions";

type Feedback = { status: "success" | "warning" | "error"; text: string };

export function CartItemRow({ item }: { item: CartSummaryItem }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CartQuantityForm>({
    resolver: zodResolver(cartQuantityFormSchema),
    defaultValues: { quantity: item.quantity },
  });

  const maxQuantity = Math.min(99, Math.max(1, item.stock));
  const submitQuantity = handleSubmit((values) => {
    setFeedback(null);
    startTransition(async () => {
      const response = await updateCartItem(item.id, values.quantity);
      if (response.message) {
        setFeedback({
          status: response.status === "error" ? "error" : response.status,
          text: response.message,
        });
      }
    });
  });

  const step = (delta: number) => {
    const next = Math.max(1, Math.min(maxQuantity, getValues("quantity") + delta));
    setValue("quantity", next, { shouldValidate: true });
    void submitQuantity();
  };

  const handleRemove = () => {
    setFeedback(null);
    startTransition(async () => {
      const response = await removeCartItem(item.id);
      if (response.message) {
        setFeedback({
          status: response.status === "error" ? "error" : response.status,
          text: response.message,
        });
      }
    });
  };

  return (
    <li className="flex flex-col gap-4 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-center">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-primary-soft/40">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.productName} fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-text-muted">
            Sin imagen
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link href={`/producto/${item.productSlug}`} className="font-heading font-semibold text-text hover:text-primary">
          {item.productName}
        </Link>
        <p className="mt-0.5 text-sm text-text-muted">{item.variantLabel}</p>
        <p className="mt-1 text-xs text-text-muted">
          {formatMoney(item.unitPriceCents)} por unidad · SKU {item.sku}
        </p>
        <p className="mt-1 font-semibold text-primary sm:hidden">{formatMoney(item.lineTotalCents)}</p>

        {item.stockWarning ? (
          <p className="mt-2 rounded-lg bg-warning/10 px-2 py-1 text-xs text-warning">
            {item.stockWarning}
          </p>
        ) : null}
        {item.priceWarning ? (
          <p className="mt-1 rounded-lg bg-warning/10 px-2 py-1 text-xs text-warning">
            {item.priceWarning}
          </p>
        ) : null}
        {feedback ? (
          <p
            role={feedback.status === "error" ? "alert" : "status"}
            className={`mt-2 rounded-lg px-2 py-1 text-xs ${
              feedback.status === "error" ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"
            }`}
          >
            {feedback.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <form onSubmit={submitQuantity} className="flex items-center gap-1" noValidate>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Quitar una unidad de ${item.productName}`}
            disabled={isPending || item.quantity <= 1}
            onClick={() => step(-1)}
          >
            <Minus aria-hidden />
          </Button>
          <Input
            type="number"
            min={1}
            max={maxQuantity}
            aria-label={`Cantidad de ${item.productName}`}
            aria-invalid={Boolean(errors.quantity)}
            disabled={isPending || item.stock <= 0}
            className="w-16 text-center"
            {...register("quantity", { valueAsNumber: true })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Agregar una unidad de ${item.productName}`}
            disabled={isPending || getValues("quantity") >= maxQuantity}
            onClick={() => step(1)}
          >
            <Plus aria-hidden />
          </Button>
          <Button type="submit" size="sm" disabled={isPending || item.stock <= 0} className="ml-1">
            {isPending ? "Actualizando…" : "Actualizar"}
          </Button>
        </form>
        <p className="hidden w-28 text-right font-semibold text-text sm:block">
          {formatMoney(item.lineTotalCents)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Sacar ${item.productName} del carrito`}
          disabled={isPending}
          onClick={handleRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
