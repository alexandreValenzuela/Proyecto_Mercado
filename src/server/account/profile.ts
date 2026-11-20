"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  profileActionError,
  profileActionSuccess,
  type ProfileActionState,
} from "@/lib/account/action-types";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import { profileSchema } from "@/lib/validators/profile";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

export async function getProfileForUser(userId: string) {
  const rows = await getDb()
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return profileActionError("No tenés permisos para realizar esta acción.");
    }
    throw error;
  }

  const parsed = profileSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
  });
  if (!parsed.success) {
    return profileActionError("Revisá tus datos personales.", fieldErrorsFrom(parsed.error));
  }

  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  try {
    // Solo se tocan los campos editables del propio usuario.
    await getDb()
      .update(users)
      .set({ name: parsed.data.name, phone })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("updateProfileAction", error);
    return profileActionError("No se pudo guardar el perfil. Intentá de nuevo.");
  }

  revalidatePath("/cuenta/perfil");
  // El nombre del cliente también aparece en la administración.
  revalidatePath("/admin/clientes");
  return profileActionSuccess("Tus datos se actualizaron correctamente.");
}
