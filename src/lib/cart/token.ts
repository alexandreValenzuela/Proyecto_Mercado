import { cookies } from "next/headers";
import { z } from "zod";

export const CART_COOKIE = "cart_token";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const PRICE_SNAPSHOT_COOKIE = "cart_price_snapshot";
const MERGE_NOTICE_COOKIE = "cart_merge_notice";

const tokenPattern = /^[A-Za-z0-9-]{16,80}$/;
const priceSnapshotSchema = z.record(z.string(), z.number().int().nonnegative());

/** Tokens opacos: dos UUID sufren para evitar colisiones y valores predecibles. */
export function createCartToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
}

/**
 * Solo lectura: se usa durante el render. Nunca genera ni escribe cookies acá,
 * porque Next.js no permite mutar la respuesta desde un Server Component.
 */
export async function readCartToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && tokenPattern.test(value) ? value : null;
}

/** Escritura: llamar solo desde Server Actions o Route Handlers. */
export async function writeCartToken(token: string): Promise<void> {
  (await cookies()).set({
    name: CART_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export async function clearCartToken(): Promise<void> {
  (await cookies()).delete({ name: CART_COOKIE, path: "/" });
}

/**
 * Precio vigente al momento de agregar cada variante. Es solo una pista para
 * avisar cambios: los totales siempre se recalculan desde la base de datos.
 */
export async function readCartPriceSnapshot(): Promise<Record<string, number>> {
  const raw = (await cookies()).get(PRICE_SNAPSHOT_COOKIE)?.value;
  if (!raw) {
    return {};
  }

  try {
    const parsed = priceSnapshotSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function writeCartPriceSnapshot(prices: Record<string, number>): Promise<void> {
  const entries = Object.entries(prices).slice(0, 40);
  const store = await cookies();

  if (entries.length === 0) {
    store.delete({ name: PRICE_SNAPSHOT_COOKIE, path: "/" });
    return;
  }

  store.set({
    name: PRICE_SNAPSHOT_COOKIE,
    value: JSON.stringify(Object.fromEntries(entries)),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export async function removeCartPriceSnapshot(variantId: string): Promise<void> {
  const prices = await readCartPriceSnapshot();
  delete prices[variantId];
  await writeCartPriceSnapshot(prices);
}

/** Aviso de una sola vez cuando la fusión al loguearse perdió cantidades por stock. */
export async function readCartMergeNotice(): Promise<boolean> {
  return (await cookies()).get(MERGE_NOTICE_COOKIE)?.value === "1";
}

export async function setCartMergeNotice(): Promise<void> {
  (await cookies()).set({
    name: MERGE_NOTICE_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearCartMergeNotice(): Promise<void> {
  (await cookies()).delete({ name: MERGE_NOTICE_COOKIE, path: "/" });
}
