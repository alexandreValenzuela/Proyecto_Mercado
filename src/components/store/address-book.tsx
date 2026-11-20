"use client";

import { MapPin, Pencil, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AddressForm } from "@/components/store/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AddressView } from "@/lib/checkout/view-types";
import { deleteAddressAction, setDefaultAddressAction } from "@/server/account/address-actions";

export function AddressBook({ addresses }: { addresses: AddressView[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(addresses.length === 0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAction = (id: string, action: () => Promise<{ ok: boolean; message: string | null }>) => {
    setFeedback(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setFeedback(result.message);
      setPendingId(null);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback ? (
        <p role="status" className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary">
          {feedback}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <Card className="border-border bg-surface">
          <CardContent className="py-10 text-center text-text-muted">
            Todavía no guardaste direcciones. Cargá una para agilizar tus próximas compras.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              {editingId === address.id ? (
                <AddressForm
                  address={address}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <Card className="h-full border-border bg-surface shadow-sm">
                  <CardContent className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-heading font-bold text-text">{address.recipientName}</p>
                      {address.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">
                          <Star className="size-3" aria-hidden /> Predeterminada
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-text-muted">
                      {address.street} {address.number}
                      {address.floorApt ? `, ${address.floorApt}` : ""}
                      <br />
                      {address.city}, {address.province} · CP {address.postalCode}
                      <br />
                      {address.phone}
                    </p>
                    {address.notes ? (
                      <p className="rounded-lg bg-surface-muted px-2 py-1 text-xs text-text-muted">
                        {address.notes}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {!address.isDefault ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            runAction(address.id, () => setDefaultAddressAction(address.id))
                          }
                        >
                          <Star aria-hidden /> Hacer predeterminada
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setEditingId(address.id)}
                      >
                        <Pencil aria-hidden /> Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending && pendingId === address.id}
                        onClick={() =>
                          runAction(address.id, () => deleteAddressAction(address.id))
                        }
                      >
                        <Trash2 aria-hidden /> Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        {showCreate ? (
          <AddressForm onCancel={addresses.length > 0 ? () => setShowCreate(false) : undefined} />
        ) : (
          <Button type="button" variant="outline" size="lg" onClick={() => setShowCreate(true)}>
            <MapPin aria-hidden /> Agregar dirección
          </Button>
        )}
      </div>
    </div>
  );
}
