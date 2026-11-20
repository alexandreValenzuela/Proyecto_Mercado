"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import {
  createAddressForUser,
  deleteAddressForUser,
  setDefaultAddressForUser,
  updateAddressForUser,
} from "@/db/queries/addresses";
import { requireUser } from "@/lib/auth/helpers";
import { addressInputSchema, type AddressInput } from "@/lib/validators/address";

export type AddressActionResult = {
  ok: boolean;
  message: string | null;
  fieldErrors: Partial<Record<keyof AddressInput | string, string>>;
};

function failure(message: string, fieldErrors: Partial<Record<string, string>> = {}): AddressActionResult {
  return { ok: false, message, fieldErrors };
}

function fieldErrorsFrom(error: ZodError): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

function revalidateAddresses(): void {
  revalidatePath("/cuenta/direcciones");
  revalidatePath("/checkout");
}

export async function createAddressAction(input: unknown): Promise<AddressActionResult> {
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Revisá los datos de la dirección.", fieldErrorsFrom(parsed.error));
  }

  try {
    const session = await requireUser();
    await createAddressForUser(session.user.id, parsed.data);
    revalidateAddresses();
    return { ok: true, message: "Dirección guardada.", fieldErrors: {} };
  } catch (error) {
    console.error("createAddressAction", error);
    return failure("No se pudo guardar la dirección. Intentá de nuevo.");
  }
}

export async function updateAddressAction(addressId: unknown, input: unknown): Promise<AddressActionResult> {
  if (typeof addressId !== "string") {
    return failure("No se encontró la dirección.");
  }
  const parsed = addressInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Revisá los datos de la dirección.", fieldErrorsFrom(parsed.error));
  }

  try {
    const session = await requireUser();
    const updated = await updateAddressForUser(session.user.id, addressId, parsed.data);
    if (!updated) {
      return failure("No encontramos esa dirección en tu cuenta.");
    }
    revalidateAddresses();
    return { ok: true, message: "Dirección actualizada.", fieldErrors: {} };
  } catch (error) {
    console.error("updateAddressAction", error);
    return failure("No se pudo actualizar la dirección. Intentá de nuevo.");
  }
}

export async function deleteAddressAction(addressId: unknown): Promise<AddressActionResult> {
  if (typeof addressId !== "string") {
    return failure("No se encontró la dirección.");
  }

  try {
    const session = await requireUser();
    const deleted = await deleteAddressForUser(session.user.id, addressId);
    if (!deleted) {
      return failure("No encontramos esa dirección en tu cuenta.");
    }
    revalidateAddresses();
    return { ok: true, message: "Dirección eliminada.", fieldErrors: {} };
  } catch (error) {
    console.error("deleteAddressAction", error);
    return failure("No se pudo eliminar la dirección. Intentá de nuevo.");
  }
}

export async function setDefaultAddressAction(addressId: unknown): Promise<AddressActionResult> {
  if (typeof addressId !== "string") {
    return failure("No se encontró la dirección.");
  }

  try {
    const session = await requireUser();
    const updated = await setDefaultAddressForUser(session.user.id, addressId);
    if (!updated) {
      return failure("No encontramos esa dirección en tu cuenta.");
    }
    revalidateAddresses();
    return { ok: true, message: "Dirección predeterminada actualizada.", fieldErrors: {} };
  } catch (error) {
    console.error("setDefaultAddressAction", error);
    return failure("No se pudo actualizar la dirección. Intentá de nuevo.");
  }
}
