"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialSettingsActionState } from "@/lib/settings/action-types";
import { updateStoreSettingsAction } from "@/server/admin/settings";

export type SettingsFormInitial = {
  storeName: string;
  shippingFlatCents: number;
  freeShippingThresholdCents: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  pickupInstructions: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-danger">{message}</p> : null;
}

export function SettingsForm({ initial }: { initial: SettingsFormInitial }) {
  const [state, formAction, pending] = useActionState(
    updateStoreSettingsAction,
    initialSettingsActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="settings-store-name">Nombre de la tienda</Label>
        <Input
          id="settings-store-name"
          name="storeName"
          defaultValue={initial.storeName}
          aria-invalid={Boolean(state.fieldErrors.storeName)}
        />
        <FieldError message={state.fieldErrors.storeName} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-shipping">Costo de envío fijo (centavos)</Label>
          <Input
            id="settings-shipping"
            name="shippingFlatCents"
            inputMode="numeric"
            defaultValue={String(initial.shippingFlatCents)}
            aria-invalid={Boolean(state.fieldErrors.shippingFlatCents)}
          />
          <p className="text-xs text-text-muted">Ejemplo: 1200 equivale a $ 12,00.</p>
          <FieldError message={state.fieldErrors.shippingFlatCents} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-free-shipping">Envío gratis desde (centavos)</Label>
          <Input
            id="settings-free-shipping"
            name="freeShippingThresholdCents"
            inputMode="numeric"
            defaultValue={
              initial.freeShippingThresholdCents === null
                ? ""
                : String(initial.freeShippingThresholdCents)
            }
            placeholder="Vacío = sin umbral"
            aria-invalid={Boolean(state.fieldErrors.freeShippingThresholdCents)}
          />
          <FieldError message={state.fieldErrors.freeShippingThresholdCents} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-border bg-surface-muted/40 p-3">
          <input type="hidden" name="pickupEnabled" value="false" />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="settings-pickup"
              name="pickupEnabled"
              value="true"
              defaultChecked={initial.pickupEnabled}
              className="size-4 accent-primary"
            />
            <Label htmlFor="settings-pickup">Habilitar retiro en persona</Label>
          </div>
          <FieldError message={state.fieldErrors.pickupEnabled} />
        </div>
        <div className="space-y-1.5 rounded-xl border border-border bg-surface-muted/40 p-3">
          <input type="hidden" name="deliveryEnabled" value="false" />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="settings-delivery"
              name="deliveryEnabled"
              value="true"
              defaultChecked={initial.deliveryEnabled}
              className="size-4 accent-primary"
            />
            <Label htmlFor="settings-delivery">Habilitar envío a domicilio</Label>
          </div>
          <FieldError message={state.fieldErrors.deliveryEnabled} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-pickup-instructions">Instrucciones de retiro</Label>
        <Input
          id="settings-pickup-instructions"
          name="pickupInstructions"
          defaultValue={initial.pickupInstructions ?? ""}
          placeholder="Ej.: Retiro en local de lunes a viernes, de 10 a 18 h."
          aria-invalid={Boolean(state.fieldErrors.pickupInstructions)}
        />
        <FieldError message={state.fieldErrors.pickupInstructions} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-email">Email de contacto</Label>
          <Input
            id="settings-email"
            name="contactEmail"
            type="email"
            defaultValue={initial.contactEmail ?? ""}
            placeholder="contacto@ejemplo.com"
            aria-invalid={Boolean(state.fieldErrors.contactEmail)}
          />
          <FieldError message={state.fieldErrors.contactEmail} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-whatsapp">WhatsApp de contacto</Label>
          <Input
            id="settings-whatsapp"
            name="contactWhatsapp"
            defaultValue={initial.contactWhatsapp ?? ""}
            placeholder="Ej.: 5491112345678"
            aria-invalid={Boolean(state.fieldErrors.contactWhatsapp)}
          />
          <FieldError message={state.fieldErrors.contactWhatsapp} />
        </div>
      </div>

      {state.message ? (
        <p
          role="status"
          className={`rounded-xl px-3 py-2 text-xs ${
            state.ok ? "bg-primary-soft text-primary" : "bg-danger/10 text-danger"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar configuración"}
      </Button>
    </form>
  );
}
