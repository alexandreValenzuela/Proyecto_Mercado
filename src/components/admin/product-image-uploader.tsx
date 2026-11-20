"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { initialCatalogActionState } from "@/lib/catalog/action-types";
import {
  saveProductImageAction,
  signImageUploadAction,
} from "@/server/admin/products";

export function ProductImageUploader({
  productId,
  nextPosition,
  disabled,
}: {
  productId: string;
  nextPosition: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    try {
      const signature = await signImageUploadAction();
      if (!signature.ok) {
        setError(signature.error);
        return;
      }

      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signature.data.apiKey);
      body.append("timestamp", String(signature.data.timestamp));
      body.append("folder", signature.data.folder);
      body.append("signature", signature.data.signature);

      const response = await fetch(signature.data.uploadUrl, { method: "POST", body });
      if (!response.ok) {
        setError("Cloudinary rechazó la imagen. Revisá la configuración y el archivo.");
        return;
      }

      const uploaded = (await response.json()) as { secure_url?: string; public_id?: string };
      if (!uploaded.secure_url || !uploaded.public_id) {
        setError("Cloudinary no devolvió los datos de la imagen.");
        return;
      }

      const payload = new FormData();
      payload.append(
        "payload",
        JSON.stringify({
          productId,
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          position: nextPosition,
        }),
      );

      const saved = await saveProductImageAction(initialCatalogActionState, payload);
      if (saved.status === "error") {
        setError(saved.message ?? "No se pudo guardar la imagen.");
        return;
      }

      router.refresh();
    } catch {
      setError("No se pudo subir la imagen. Intentá de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="product-image-file">Agregar imagen</Label>
      <label
        htmlFor="product-image-file"
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm text-text-muted hover:border-primary hover:text-primary"
      >
        {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {uploading ? "Subiendo…" : "Elegir archivo (JPG, PNG o WebP)"}
      </label>
      <input
        id="product-image-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.target.value = "";
        }}
      />
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
