import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listAddressesForUser } from "@/db/queries/addresses";
import { getStoreSettings } from "@/db/queries/orders";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import type { AddressView, CheckoutSettingsView } from "@/lib/checkout/view-types";
import { getCartSummary } from "@/server/cart/actions";

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="h-96 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
    </div>
  );
}

async function CheckoutContent() {
  // auth() genera un valor aleatorio de CSRF: hay que diferir a request time.
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // El carrito vive en una cookie, así que queda intacto tras el login.
      redirect("/login?next=/checkout");
    }
    throw error;
  }

  const [cart, addressRows, settings] = await Promise.all([
    getCartSummary(),
    listAddressesForUser(userId),
    getStoreSettings(),
  ]);

  if (cart.items.length === 0) {
    return (
      <Card className="border-border bg-surface">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ShoppingBag className="size-7" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-xl font-bold text-text">Tu carrito está vacío</p>
            <p className="mt-1 text-sm text-text-muted">
              Agregá productos antes de continuar con el pago.
            </p>
          </div>
          <Link href="/catalogo" className={buttonVariants({ size: "lg" })}>
            Ver el catálogo
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!settings || (!settings.deliveryEnabled && !settings.pickupEnabled)) {
    return (
      <Card className="border-border bg-surface">
        <CardContent className="py-12 text-center">
          <p className="font-heading text-xl font-bold text-text">
            No hay formas de entrega disponibles
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Avisá al administrador para que habilite el envío o el retiro.
          </p>
        </CardContent>
      </Card>
    );
  }

  const addresses: AddressView[] = addressRows.map((row) => ({
    id: row.id,
    recipientName: row.recipientName,
    phone: row.phone,
    street: row.street,
    number: row.number,
    floorApt: row.floorApt,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    notes: row.notes,
    isDefault: row.isDefault,
  }));

  const settingsView: CheckoutSettingsView = {
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    shippingFlatCents: settings.shippingFlatCents,
    freeShippingThresholdCents: settings.freeShippingThresholdCents,
    pickupInstructions: settings.pickupInstructions,
  };

  return <CheckoutForm addresses={addresses} settings={settingsView} cart={cart} />;
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Finalizar compra</h1>
        <p className="mt-2 text-text-muted">
          Elegí cómo recibir tu pedido y pagá de forma segura con MercadoPago.
        </p>
      </div>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}
