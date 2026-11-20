"use client";

import { useRouter } from "next/navigation";
import { useEffect, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialCatalogActionState } from "@/lib/catalog/action-types";
import { saveCategoryAction } from "@/server/admin/categories";

export type CategoryFormInitial = {
  id?: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  active: boolean;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial: CategoryFormInitial;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveCategoryAction, initialCatalogActionState);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [parentId, setParentId] = useState(initial.parentId ?? "");
  const [position, setPosition] = useState(String(initial.position));
  const [active, setActive] = useState(initial.active);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  const payload = JSON.stringify({
    ...(initial.id ? { id: initial.id } : {}),
    name,
    slug,
    parentId: parentId || null,
    position: Number(position) || 0,
    active,
  });

  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardHeader>
        <CardTitle className="text-text">{initial.id ? "Editar categoría" : "Nueva categoría"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="payload" value={payload} />
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (!slugTouched) {
                  setSlug(slugify(next));
                }
              }}
              aria-invalid={Boolean(state.fieldErrors.name)}
            />
            {state.fieldErrors.name ? <p className="text-xs text-danger">{state.fieldErrors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              aria-invalid={Boolean(state.fieldErrors.slug)}
            />
            {state.fieldErrors.slug ? <p className="text-xs text-danger">{state.fieldErrors.slug}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-parent">Categoría padre</Label>
            <select
              id="category-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
            >
              <option value="">Ninguna</option>
              {categories
                .filter((category) => category.id !== initial.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
            {state.fieldErrors.parentId ? (
              <p className="text-xs text-danger">{state.fieldErrors.parentId}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-position">Posición</Label>
            <Input
              id="category-position"
              type="number"
              min={0}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Categoría activa
          </label>
          {state.message ? (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-xs ${
                state.status === "error" ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"
              }`}
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar categoría"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
