"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { slugInUse } from "@/db/queries/catalog";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import {
  catalogActionError,
  catalogActionSuccess,
  type CatalogActionState,
} from "@/lib/catalog/action-types";
import { categoryInputSchema } from "@/lib/validators/catalog";

async function requireAdminOrError(): Promise<string | null> {
  try {
    const session = await requireAdmin();
    return session.user.id;
  } catch {
    return null;
  }
}

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

export async function saveCategoryAction(
  _prev: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return catalogActionError("No tenés permisos para realizar esta acción.");
  }

  const parsed = categoryInputSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return catalogActionError("Revisá los datos de la categoría.", fieldErrors);
  }

  const input = parsed.data;
  if (input.id && input.parentId === input.id) {
    return catalogActionError("Una categoría no puede ser su propia padre.", {
      parentId: "Elegí otra categoría padre.",
    });
  }

  if (input.parentId) {
    const [parent] = await getDb()
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.parentId))
      .limit(1);
    if (!parent) {
      return catalogActionError("La categoría padre no existe.", {
        parentId: "Elegí una categoría válida.",
      });
    }
  }

  if (await slugInUse("categories", input.slug, input.id)) {
    return catalogActionError("El slug ya está en uso.", {
      slug: "Ese slug ya pertenece a otra categoría.",
    });
  }

  const values = {
    name: input.name,
    slug: input.slug,
    parentId: input.parentId,
    position: input.position,
    active: input.active,
  };

  try {
    if (input.id) {
      await getDb().update(categories).set(values).where(eq(categories.id, input.id));
    } else {
      await getDb().insert(categories).values(values);
    }
  } catch {
    return catalogActionError("No se pudo guardar la categoría. Intentá de nuevo.");
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/catalogo");
  revalidatePath("/");
  return catalogActionSuccess("Categoría guardada correctamente.");
}

export async function toggleCategoryActiveAction(formData: FormData): Promise<void> {
  const adminId = await requireAdminOrError();
  if (!adminId) {
    return;
  }

  const rawId = formData.get("categoryId");
  if (typeof rawId !== "string" || !/^[0-9a-f-]{36}$/i.test(rawId)) {
    return;
  }

  const [current] = await getDb()
    .select({ active: categories.active })
    .from(categories)
    .where(eq(categories.id, rawId))
    .limit(1);
  if (!current) {
    return;
  }

  await getDb()
    .update(categories)
    .set({ active: !current.active })
    .where(eq(categories.id, rawId));

  revalidatePath("/admin/categorias");
  revalidatePath("/catalogo");
  revalidatePath("/");
}
