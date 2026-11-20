"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddressView } from "@/lib/checkout/view-types";
import { ARGENTINE_PROVINCES } from "@/lib/provinces";
import { addressInputSchema, type AddressFormInput } from "@/lib/validators/address";
import { createAddressAction, updateAddressAction } from "@/server/account/address-actions";

type Props = {
  address?: AddressView;
  onCancel?: () => void;
  onSaved?: () => void;
};

export function AddressForm({ address, onCancel, onSaved }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormInput>({
    resolver: zodResolver(addressInputSchema),
    defaultValues: {
      recipientName: address?.recipientName ?? "",
      phone: address?.phone ?? "",
      street: address?.street ?? "",
      number: address?.number ?? "",
      floorApt: address?.floorApt ?? "",
      city: address?.city ?? "",
      province: address?.province ?? "Buenos Aires",
      postalCode: address?.postalCode ?? "",
      notes: address?.notes ?? "",
      isDefault: address?.isDefault ?? false,
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFeedback(null);
    startTransition(async () => {
      const result = address
        ? await updateAddressAction(address.id, values)
        : await createAddressAction(values);
      if (!result.ok) {
        setFeedback(result.message ?? "No se pudo guardar la dirección.");
        return;
      }
      if (!address) {
        reset();
      }
      onSaved?.();
      router.refresh();
    });
  });

  const fieldClass = "mt-1 w-full";
  const error = (name: keyof AddressFormInput) =>
    errors[name] ? (
      <p role="alert" className="mt-1 text-xs text-danger">
        {String(errors[name]?.message)}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`recipient-${address?.id ?? "new"}`}>¿Quién recibe?</Label>
          <Input
            id={`recipient-${address?.id ?? "new"}`}
            autoComplete="name"
            aria-invalid={Boolean(errors.recipientName)}
            className={fieldClass}
            {...register("recipientName")}
          />
          {error("recipientName")}
        </div>
        <div>
          <Label htmlFor={`phone-${address?.id ?? "new"}`}>Teléfono</Label>
          <Input
            id={`phone-${address?.id ?? "new"}`}
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            className={fieldClass}
            {...register("phone")}
          />
          {error("phone")}
        </div>
        <div>
          <Label htmlFor={`street-${address?.id ?? "new"}`}>Calle</Label>
          <Input
            id={`street-${address?.id ?? "new"}`}
            autoComplete="address-line1"
            aria-invalid={Boolean(errors.street)}
            className={fieldClass}
            {...register("street")}
          />
          {error("street")}
        </div>
        <div>
          <Label htmlFor={`number-${address?.id ?? "new"}`}>Número</Label>
          <Input
            id={`number-${address?.id ?? "new"}`}
            autoComplete="address-line2"
            aria-invalid={Boolean(errors.number)}
            className={fieldClass}
            {...register("number")}
          />
          {error("number")}
        </div>
        <div>
          <Label htmlFor={`floor-${address?.id ?? "new"}`}>Piso / Depto (opcional)</Label>
          <Input
            id={`floor-${address?.id ?? "new"}`}
            className={fieldClass}
            {...register("floorApt")}
          />
        </div>
        <div>
          <Label htmlFor={`city-${address?.id ?? "new"}`}>Ciudad</Label>
          <Input
            id={`city-${address?.id ?? "new"}`}
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            className={fieldClass}
            {...register("city")}
          />
          {error("city")}
        </div>
        <div>
          <Label htmlFor={`province-${address?.id ?? "new"}`}>Provincia</Label>
          <select
            id={`province-${address?.id ?? "new"}`}
            autoComplete="address-level1"
            aria-invalid={Boolean(errors.province)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            {...register("province")}
          >
            {ARGENTINE_PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          {error("province")}
        </div>
        <div>
          <Label htmlFor={`postal-${address?.id ?? "new"}`}>Código postal</Label>
          <Input
            id={`postal-${address?.id ?? "new"}`}
            autoComplete="postal-code"
            aria-invalid={Boolean(errors.postalCode)}
            className={fieldClass}
            {...register("postalCode")}
          />
          {error("postalCode")}
        </div>
      </div>

      <div>
        <Label htmlFor={`notes-${address?.id ?? "new"}`}>Indicaciones (opcional)</Label>
        <Input
          id={`notes-${address?.id ?? "new"}`}
          placeholder="Ej.: timbre 2B, dejar con el portero"
          className={fieldClass}
          {...register("notes")}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("isDefault")} />
        Usar como dirección predeterminada
      </label>

      {feedback ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {feedback}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando…" : address ? "Guardar cambios" : "Guardar dirección"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
