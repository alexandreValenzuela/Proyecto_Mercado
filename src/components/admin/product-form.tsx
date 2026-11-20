"use client";

import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useActionState, useState } from "react";
import { ProductImageUploader } from "@/components/admin/product-image-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialCatalogActionState } from "@/lib/catalog/action-types";
import { centsToInput, parsePriceToCents } from "@/lib/money";
import {
  deleteProductImageAction,
  saveProductAction,
} from "@/server/admin/products";

type InitialVariant = {
  id?: string;
  sku: string;
  label: string;
  attributes: Record<string, string>;
  priceCents: number | null;
  costCents: number | null;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
};

type LocalVariant = Omit<InitialVariant, "priceCents" | "costCents"> & {
  price: string;
  cost: string;
};

export type ProductFormInitial = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePriceCents: number;
  costCents: number | null;
  active: boolean;
  variants: InitialVariant[];
  images: { id?: string; url: string; publicId: string | null; position: number }[];
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLocalVariant(variant: InitialVariant): LocalVariant {
  return {
    ...variant,
    price: centsToInput(variant.priceCents),
    cost: centsToInput(variant.costCents),
  };
}

export function ProductForm({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial: ProductFormInitial;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveProductAction, initialCatalogActionState);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [description, setDescription] = useState(initial.description);
  const [basePrice, setBasePrice] = useState(centsToInput(initial.basePriceCents));
  const [cost, setCost] = useState(centsToInput(initial.costCents));
  const [active, setActive] = useState(initial.active);
  const [variants, setVariants] = useState<LocalVariant[]>(
    initial.variants.length > 0
      ? initial.variants.map(toLocalVariant)
      : [
          {
            sku: "",
            label: "Única",
            attributes: {},
            price: "",
            cost: "",
            stock: 0,
            lowStockThreshold: 3,
            active: true,
          },
        ],
  );

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  function updateVariant(index: number, patch: Partial<LocalVariant>) {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    );
  }

  const payload = JSON.stringify({
    ...(initial.id ? { id: initial.id } : {}),
    name,
    slug,
    description,
    categoryId,
    basePriceCents: parsePriceToCents(basePrice) ?? -1,
    costCents: cost.trim() === "" ? null : parsePriceToCents(cost),
    active,
    variants: variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      sku: variant.sku,
      label: variant.label,
      attributes: variant.attributes,
      priceCents: variant.price.trim() === "" ? null : parsePriceToCents(variant.price),
      costCents: variant.cost.trim() === "" ? null : parsePriceToCents(variant.cost),
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      active: variant.active,
    })),
    images: initial.images.map((image) => ({
      ...(image.id ? { id: image.id } : {}),
      url: image.url,
      publicId: image.publicId,
      position: image.position,
    })),
  });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="payload" value={payload} />

      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Datos del producto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
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
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              aria-invalid={Boolean(state.fieldErrors.slug)}
            />
            {state.fieldErrors.slug ? <p className="text-xs text-danger">{state.fieldErrors.slug}</p> : null}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-category">Categoría</Label>
            <select
              id="product-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-sm"
              aria-invalid={Boolean(state.fieldErrors.categoryId)}
            >
              <option value="">Elegí una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {state.fieldErrors.categoryId ? (
              <p className="text-xs text-danger">{state.fieldErrors.categoryId}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-base-price">Precio base ($)</Label>
            <Input
              id="product-base-price"
              inputMode="decimal"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
              aria-invalid={Boolean(state.fieldErrors.basePriceCents)}
            />
            {state.fieldErrors.basePriceCents ? (
              <p className="text-xs text-danger">{state.fieldErrors.basePriceCents}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-cost">Costo unitario ($)</Label>
            <Input
              id="product-cost"
              inputMode="decimal"
              value={cost}
              placeholder="Opcional"
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-description">Descripción</Label>
            <textarea
              id="product-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text sm:col-span-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Producto activo (visible en el catálogo)
          </label>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-text">Variantes</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setVariants((current) => [
                ...current,
                {
                  sku: "",
                  label: "",
                  attributes: {},
                  price: "",
                  cost: "",
                  stock: 0,
                  lowStockThreshold: 3,
                  active: true,
                },
              ])
            }
          >
            <Plus className="size-4" aria-hidden /> Agregar variante
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.fieldErrors.variants ? (
            <p className="text-xs text-danger">{state.fieldErrors.variants}</p>
          ) : null}
          {variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="rounded-2xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">Variante {index + 1}</p>
                {variants.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" aria-hidden /> Quitar
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-sku-${index}`}>SKU</Label>
                  <Input
                    id={`variant-sku-${index}`}
                    value={variant.sku}
                    onChange={(event) => updateVariant(index, { sku: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-label-${index}`}>Etiqueta</Label>
                  <Input
                    id={`variant-label-${index}`}
                    value={variant.label}
                    onChange={(event) => updateVariant(index, { label: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-stock-${index}`}>Stock</Label>
                  <Input
                    id={`variant-stock-${index}`}
                    type="number"
                    min={0}
                    value={variant.stock}
                    onChange={(event) => updateVariant(index, { stock: Number(event.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-price-${index}`}>Precio ($)</Label>
                  <Input
                    id={`variant-price-${index}`}
                    inputMode="decimal"
                    value={variant.price}
                    placeholder="Usa el precio base"
                    onChange={(event) => updateVariant(index, { price: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-cost-${index}`}>Costo ($)</Label>
                  <Input
                    id={`variant-cost-${index}`}
                    inputMode="decimal"
                    value={variant.cost}
                    placeholder="Usa el costo del producto"
                    onChange={(event) => updateVariant(index, { cost: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`variant-threshold-${index}`}>Alerta de stock</Label>
                  <Input
                    id={`variant-threshold-${index}`}
                    type="number"
                    min={0}
                    value={variant.lowStockThreshold}
                    onChange={(event) =>
                      updateVariant(index, { lowStockThreshold: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-text sm:col-span-3">
                  <input
                    type="checkbox"
                    checked={variant.active}
                    onChange={(event) => updateVariant(index, { active: event.target.checked })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  Variante activa
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-text">Imágenes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {initial.images.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {initial.images.map((image) => (
                <div key={image.id ?? image.url} className="relative w-24 space-y-1">
                  <Image src={image.url} alt="Imagen del producto" width={96} height={96} className="rounded-xl border border-border object-cover" />
                  <p className="text-center text-xs text-text-muted">Pos. {image.position}</p>
                  <form action={deleteProductImageAction}>
                    <input type="hidden" name="imageId" value={image.id ?? ""} />
                    <input type="hidden" name="productId" value={initial.id ?? ""} />
                    <Button type="submit" variant="ghost" size="xs" className="w-full">
                      Quitar
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Todavía no hay imágenes cargadas.</p>
          )}
          {initial.id ? (
            <ProductImageUploader
              productId={initial.id}
              nextPosition={initial.images.length}
              disabled={pending}
            />
          ) : (
            <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-text-muted">
              Guardá el producto para poder subir imágenes.
            </p>
          )}
          {state.fieldErrors.images ? (
            <p className="text-xs text-danger">{state.fieldErrors.images}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar producto"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    </form>
  );
}
