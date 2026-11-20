import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddressBook } from "@/components/store/address-book";
import { buttonVariants } from "@/components/ui/button";
import { listAddressesForUser } from "@/db/queries/addresses";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import type { AddressView } from "@/lib/checkout/view-types";

async function AddressesContent() {
  await connection();
  let userId: string;
  try {
    userId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect("/login?next=/cuenta/direcciones");
    }
    throw error;
  }

  const rows = await listAddressesForUser(userId);
  const addresses: AddressView[] = rows.map((row) => ({
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

  return <AddressBook addresses={addresses} />;
}

function AddressesSkeleton() {
  return <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" />;
}

export default function AddressesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">Mis direcciones</h1>
          <p className="mt-2 text-text-muted">Guardá tus direcciones para pagar más rápido.</p>
        </div>
        <Link href="/cuenta/pedidos" className={buttonVariants({ variant: "outline" })}>
          Ver mis pedidos
        </Link>
      </div>
      <Suspense fallback={<AddressesSkeleton />}>
        <AddressesContent />
      </Suspense>
    </main>
  );
}
