import { getDb } from "@/db/client";
import type { StoreSettingsRow } from "@/db/queries/orders";
import { storeSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import type { StoreSettingsFormInput } from "@/lib/validators/settings";

/**
 * Actualiza la fila única de configuración. Si todavía no se cargó la semilla
 * inicial, la crea con los valores enviados: el índice único de la tabla
 * garantiza que no pueda haber más de una.
 */
export async function updateStoreSettings(input: StoreSettingsFormInput): Promise<StoreSettingsRow> {
  await requireAdmin();

  const values = {
    storeName: input.storeName,
    shippingFlatCents: Number(input.shippingFlatCents),
    freeShippingThresholdCents:
      input.freeShippingThresholdCents === ""
        ? null
        : Number(input.freeShippingThresholdCents),
    pickupEnabled: input.pickupEnabled,
    deliveryEnabled: input.deliveryEnabled,
    pickupInstructions: input.pickupInstructions || null,
    contactEmail: input.contactEmail || null,
    contactWhatsapp: input.contactWhatsapp || null,
  };

  const updated = await getDb().update(storeSettings).set(values).returning();
  if (updated[0]) {
    return updated[0];
  }

  const created = await getDb().insert(storeSettings).values(values).returning();
  if (!created[0]) {
    throw new Error("No se pudo guardar la configuración de la tienda.");
  }
  return created[0];
}
