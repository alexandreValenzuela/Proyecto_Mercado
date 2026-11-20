"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { categoryExists, getAdminProductById, slugInUse } from "@/db/queries/catalog";
import { productImages, productVariants, products } from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import { requireAdmin } from "@/lib/auth/helpers";
import {
  CLOUDINARY_FOLDER,
  createCloudinaryUploadSignature,
  getCloudinaryConfig,
  isCloudinaryImageUrl,
} from "@/lib/cloudinary";
import {
  catalogActionError,
  catalogActionSuccess,
  type CatalogActionState,
} from "@/lib/catalog/action-types";
import {
  productImageUploadSchema,
  productInputSchema,
  stockAdjustmentSchema,
} from "@/lib/validators/catalog";
import { adjustVariantStock, StockAdjustmentError } from "@/server/catalog/stock";

function payloadFrom(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "23505" || message.includes("duplicate key");
}

async function requireAdminOrError(): Promise<string | null> {
  try {
    const session = await requireAdmin();
    return session.user.id;
  } catch {
    return null;
  }
}

function revalidateCatalog(): void {
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/admin/productos");
}

export async function saveProductAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return catalogActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = productInputSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return catalogActionError("Revisá los datos del producto.", fieldErrors);
  }

  const input = parsed.data;
  if (!(await categoryExists(input.categoryId))) {
    return catalogActionError("La categoría elegida no existe.", {
      categoryId: "Elegí una categoría válida.",
    });
  }

  if (await slugInUse("products", input.slug, input.id)) {
    return catalogActionError("El slug ya está en uso.", {
      slug: "Ese slug ya pertenece a otro producto.",
    });
  }

  const skus = input.variants.map((variant) => variant.sku.toLowerCase());
  if (new Set(skus).size !== skus.length) {
    return catalogActionError("Los SKU de las variantes deben ser únicos.", {
      variants: "Hay dos variantes con el mismo SKU.",
    });
  }

  const db = getTransactionalDb();

  try {
    const productId = await db.transaction(async (tx) => {
      let currentId = input.id;

      const productValues = {
        name: input.name,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId,
        basePriceCents: input.basePriceCents,
        costCents: input.costCents,
        active: input.active,
      };

      if (currentId) {
        const [updated] = await tx
          .update(products)
          .set(productValues)
          .where(eq(products.id, currentId))
          .returning({ id: products.id });
        if (!updated) {
          throw new Error("No se encontró el producto.");
        }
      } else {
        const [created] = await tx.insert(products).values(productValues).returning({ id: products.id });
        currentId = created.id;
      }

      const keptVariantIds: string[] = [];
      for (const variant of input.variants) {
        const values = {
          sku: variant.sku,
          label: variant.label,
          attributes: variant.attributes,
          priceCents: variant.priceCents,
          costCents: variant.costCents,
          stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold,
          active: variant.active,
        };

        if (variant.id) {
          const [updated] = await tx
            .update(productVariants)
            .set(values)
            .where(and(eq(productVariants.id, variant.id), eq(productVariants.productId, currentId)))
            .returning({ id: productVariants.id });
          if (!updated) {
            throw new Error("Una variante no pertenece a este producto.");
          }
          keptVariantIds.push(updated.id);
        } else {
          const [created] = await tx
            .insert(productVariants)
            .values({ ...values, productId: currentId })
            .returning({ id: productVariants.id });
          keptVariantIds.push(created.id);
        }
      }

      // Baja lógica: las variantes que se sacaron del formulario pueden estar
      // referenciadas por pedidos, así que nunca se borran físicamente.
      await tx
        .update(productVariants)
        .set({ active: false })
        .where(
          and(
            eq(productVariants.productId, currentId),
            notInArray(productVariants.id, keptVariantIds),
          ),
        );

      for (const image of input.images) {
        if (image.id) {
          await tx
            .update(productImages)
            .set({ position: image.position })
            .where(and(eq(productImages.id, image.id), eq(productImages.productId, currentId)));
        } else {
          await tx.insert(productImages).values({
            productId: currentId,
            url: image.url,
            publicId: image.publicId,
            position: image.position,
          });
        }
      }

      return currentId;
    });

    revalidateCatalog();
    revalidatePath(`/admin/productos/${productId}`);
    return catalogActionSuccess("Producto guardado correctamente.", "/admin/productos");
  } catch (error) {
    if (isUniqueViolation(error)) {
      return catalogActionError("El SKU o el slug ya está en uso.", {
        variants: "Revisá los SKU: alguno ya existe.",
      });
    }
    return catalogActionError("No se pudo guardar el producto. Intentá de nuevo.");
  }
}

export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return;
  }

  const rawId = formData.get("productId");
  if (typeof rawId !== "string" || !/^[0-9a-f-]{36}$/i.test(rawId)) {
    return;
  }

  const existing = await getAdminProductById(rawId);
  if (!existing) {
    return;
  }

  await getDb()
    .update(products)
    .set({ active: !existing.active })
    .where(eq(products.id, rawId));

  revalidateCatalog();
}

export async function adjustStockAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return catalogActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = stockAdjustmentSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return catalogActionError("Revisá el ajuste de stock.", fieldErrors);
  }

  try {
    const result = await adjustVariantStock(parsed.data, adminId);
    revalidateCatalog();
    revalidatePath(`/admin/productos/${result.variantId}`);
    return catalogActionSuccess(
      `Stock actualizado: ${result.sku} pasó de ${result.previousStock} a ${result.nextStock} unidades.`,
    );
  } catch (error) {
    if (error instanceof StockAdjustmentError) {
      return catalogActionError(error.message);
    }
    return catalogActionError("No se pudo registrar el ajuste. Intentá de nuevo.");
  }
}

export type CloudinarySignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
};

export async function signImageUploadAction(): Promise<
  { ok: true; data: CloudinarySignature } | { ok: false; error: string }
> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return { ok: false, error: "No tenés permisos para subir imágenes." };
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.round(Date.now() / 1000);
    return {
      ok: true,
      data: {
        cloudName,
        apiKey,
        timestamp,
        folder: CLOUDINARY_FOLDER,
        signature: createCloudinaryUploadSignature({ timestamp, folder: CLOUDINARY_FOLDER, apiSecret }),
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo firmar la subida.",
    };
  }
}

export async function saveProductImageAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return catalogActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = productImageUploadSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) {
    return catalogActionError("Los datos de la imagen no son válidos.");
  }

  let config;
  try {
    config = getCloudinaryConfig();
  } catch (error) {
    return catalogActionError(error instanceof Error ? error.message : "Falta configurar Cloudinary.");
  }

  if (!isCloudinaryImageUrl(parsed.data.url, config.cloudName)) {
    return catalogActionError("La imagen debe provenir de tu cuenta de Cloudinary.");
  }

  const existing = await getAdminProductById(parsed.data.productId);
  if (!existing) {
    return catalogActionError("No se encontró el producto.");
  }

  await getDb().insert(productImages).values({
    productId: parsed.data.productId,
    url: parsed.data.url,
    publicId: parsed.data.publicId,
    position: parsed.data.position,
  });

  revalidateCatalog();
  return catalogActionSuccess("Imagen agregada.");
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return;
  }

  const rawId = formData.get("imageId");
  const rawProductId = formData.get("productId");
  if (
    typeof rawId !== "string" ||
    typeof rawProductId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(rawId) ||
    !/^[0-9a-f-]{36}$/i.test(rawProductId)
  ) {
    return;
  }

  await getDb()
    .delete(productImages)
    .where(and(eq(productImages.id, rawId), eq(productImages.productId, rawProductId)));

  revalidateCatalog();
}
