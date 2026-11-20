"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialProfileActionState } from "@/lib/account/action-types";
import { updateProfileAction } from "@/server/account/profile";

type Props = {
  initial: {
    name: string;
    phone: string;
  };
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-xs text-danger">
      {message}
    </p>
  ) : null;
}

export function ProfileForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialProfileActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nombre</Label>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          defaultValue={initial.name}
          aria-invalid={Boolean(state.fieldErrors.name)}
        />
        <FieldError message={state.fieldErrors.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Teléfono (opcional)</Label>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initial.phone}
          placeholder="Ej.: 11 5555 5555"
          aria-invalid={Boolean(state.fieldErrors.phone)}
        />
        <FieldError message={state.fieldErrors.phone} />
      </div>

      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-xl px-3 py-2 text-sm ${
            state.ok ? "bg-primary-soft text-primary" : "bg-danger/10 text-danger"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
