import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { addresses } from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import type { AddressInput } from "@/lib/validators/address";

export type AddressRow = typeof addresses.$inferSelect;

/** Toda lectura filtra por el usuario de la sesión. */
export async function listAddressesForUser(userId: string): Promise<AddressRow[]> {
  return getDb()
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function findAddressForUser(
  userId: string,
  addressId: string,
): Promise<AddressRow | null> {
  const rows = await getDb()
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Alta con transacción: marcar por defecto deja una sola fila default del usuario. */
export async function createAddressForUser(userId: string, input: AddressInput): Promise<AddressRow> {
  const db = getTransactionalDb();
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .limit(1);
    const isDefault = input.isDefault || existing.length === 0;
    if (isDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }

    const created = await tx
      .insert(addresses)
      .values({
        userId,
        recipientName: input.recipientName,
        phone: input.phone,
        street: input.street,
        number: input.number,
        floorApt: input.floorApt ?? null,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        notes: input.notes ?? null,
        isDefault,
      })
      .returning();
    return created[0];
  });
}

export async function updateAddressForUser(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressRow | null> {
  const db = getTransactionalDb();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .limit(1)
      .for("update");
    if (!owned[0]) {
      return null;
    }

    const existing = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, userId));
    const shouldBeDefault = input.isDefault || existing.length === 1;
    if (shouldBeDefault) {
      await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    }

    const updated = await tx
      .update(addresses)
      .set({
        recipientName: input.recipientName,
        phone: input.phone,
        street: input.street,
        number: input.number,
        floorApt: input.floorApt ?? null,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        notes: input.notes ?? null,
        isDefault: shouldBeDefault,
      })
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .returning();
    return updated[0] ?? null;
  });
}

export async function setDefaultAddressForUser(
  userId: string,
  addressId: string,
): Promise<AddressRow | null> {
  const db = getTransactionalDb();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .limit(1)
      .for("update");
    if (!owned[0]) {
      return null;
    }

    await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    const updated = await tx
      .update(addresses)
      .set({ isDefault: true })
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .returning();
    return updated[0] ?? null;
  });
}

export async function deleteAddressForUser(userId: string, addressId: string): Promise<boolean> {
  const db = getTransactionalDb();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: addresses.id, isDefault: addresses.isDefault })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .limit(1)
      .for("update");
    if (!owned[0]) {
      return false;
    }

    await tx
      .delete(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));

    if (owned[0].isDefault) {
      const next = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, userId))
        .limit(1);
      if (next[0]) {
        await tx
          .update(addresses)
          .set({ isDefault: true })
          .where(and(eq(addresses.id, next[0].id), eq(addresses.userId, userId)));
      }
    }

    return true;
  });
}
