import type { CartIdentity } from "@/db/queries/cart";
import { auth } from "@/auth";
import { createCartToken, readCartToken, writeCartToken } from "@/lib/cart/token";

/**
 * Resuelve la identidad del carrito. Solo las mutaciones piden `createToken`:
 * así una página nunca escribe cookies durante el render.
 */
export async function getCartIdentity(options: { createToken?: boolean } = {}): Promise<CartIdentity> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId) {
    return { userId, sessionToken: null };
  }

  const existingToken = await readCartToken();
  if (existingToken) {
    return { userId: null, sessionToken: existingToken };
  }

  if (!options.createToken) {
    return { userId: null, sessionToken: null };
  }

  const token = createCartToken();
  await writeCartToken(token);
  return { userId: null, sessionToken: token };
}
