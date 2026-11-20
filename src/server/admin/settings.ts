"use server";

import { revalidatePath } from "next/cache";
import { updateStoreSettings } from "@/db/queries/settings";
import { AuthorizationError, requireAdmin } from "@/lib/auth/helpers";
import {
  settingsActionError,
  settingsActionSuccess,
  type SettingsActionState,
} from "@/lib/settings/action-types";
import { storeSettingsFormSchema } from "@/lib/validators/settings";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Hidden input `false` + checkbox `true`: basta con que aparezca el "true". */
function booleanField(formData: FormData, key: string): boolean {
  return formData.getAll(key).includes("true");
}

function fieldErrorsFrom(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    result[field] ??= issue.message;
  }
  return result;
}

export async function updateStoreSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return settingsActionError("No tenés permisos para realizar esta acción.");
    }
    throw error;
  }

  const parsed = storeSettingsFormSchema.safeParse({
    storeName: text(formData, "storeName"),
    shippingFlatCents: text(formData, "shippingFlatCents"),
    freeShippingThresholdCents: text(formData, "freeShippingThresholdCents"),
    pickupEnabled: booleanField(formData, "pickupEnabled"),
    deliveryEnabled: booleanField(formData, "deliveryEnabled"),
    pickupInstructions: text(formData, "pickupInstructions"),
    contactEmail: text(formData, "contactEmail"),
    contactWhatsapp: text(formData, "contactWhatsapp"),
  });
  if (!parsed.success) {
    return settingsActionError("Revisá los datos de la tienda.", fieldErrorsFrom(parsed.error));
  }

  try {
    await updateStoreSettings(parsed.data);
  } catch {
    return settingsActionError("No se pudo guardar la configuración. Intentá de nuevo.");
  }

  revalidatePath("/admin/configuracion");
  // El footer y el resumen del checkout leen la configuración de la tienda.
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/checkout");
  revalidatePath("/carrito");
  return settingsActionSuccess("Configuración guardada correctamente.");
}
