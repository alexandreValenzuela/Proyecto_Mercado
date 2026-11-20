import { connection } from "next/server";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/db/queries/orders";
import { requireAdmin } from "@/lib/auth/helpers";

export default async function AdminSettingsPage() {
  await connection();
  await requireAdmin();

  const settings = await getStoreSettings();
  const initial = {
    storeName: settings?.storeName ?? siteConfig.name,
    shippingFlatCents: settings?.shippingFlatCents ?? 0,
    freeShippingThresholdCents: settings?.freeShippingThresholdCents ?? null,
    pickupEnabled: settings?.pickupEnabled ?? true,
    deliveryEnabled: settings?.deliveryEnabled ?? true,
    pickupInstructions: settings?.pickupInstructions ?? null,
    contactEmail: settings?.contactEmail ?? null,
    contactWhatsapp: settings?.contactWhatsapp ?? null,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-text">Configuración</h1>
        <p className="mt-1 text-sm text-text-muted">
          Datos de la tienda, envío, retiro y contacto. Los cambios se reflejan en todo el sitio.
        </p>
      </div>
      <Card className="border-border bg-surface shadow-sm">
        <CardContent>
          <SettingsForm initial={initial} />
        </CardContent>
      </Card>
    </main>
  );
}
