import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cartItems, carts, productVariants, products } from "@/db/schema";
import { getTransactionalDb } from "@/db/transaction";
import {
  clearCartToken,
  readCartPriceSnapshot,
  readCartToken,
  setCartMergeNotice,
  writeCartPriceSnapshot,
} from "@/lib/cart/token";

export type CartMergeResult = {
  merged: boolean;
  reducedOrDropped: boolean;
  guestItems: number;
};

const NOTHING_TO_MERGE: CartMergeResult = {
  merged: false,
  reducedOrDropped: false,
  guestItems: 0,
};

/**
 * Fusiona el carrito de la cookie en el carrito del usuario. Toda la operación
 * (lectura, cap por stock, borrado del carrito invitado) ocurre en una sola
 * transacción; las cookies se ajustan recién después de que la BD confirmó.
 * Es idempotente: si no queda carrito invitado, no hace nada.
 */
export async function mergeGuestCartIntoUserCart(userId: string): Promise<CartMergeResult> {
  const token = await readCartToken();
  if (!token || !userId) {
    return NOTHING_TO_MERGE;
  }

  const db = getTransactionalDb();
  const outcome = await db.transaction(async (tx) => {
    const guestRows = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.sessionToken, token))
      .limit(1)
      .for("update");
    const guestCart = guestRows[0];
    if (!guestCart) {
      return { ...NOTHING_TO_MERGE, prices: {} as Record<string, number> };
    }

    const guestItems = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, guestCart.id))
      .orderBy(asc(cartItems.createdAt));

    const userRows = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    let userCartId = userRows[0]?.id;
    if (!userCartId) {
      const inserted = await tx
        .insert(carts)
        .values({ userId, sessionToken: null })
        .onConflictDoNothing({ target: carts.userId })
        .returning({ id: carts.id });
      userCartId = inserted[0]?.id;
    }
    if (!userCartId) {
      const retry = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
      userCartId = retry[0]?.id;
    }
    if (!userCartId) {
      throw new Error("No se pudo resolver el carrito del usuario.");
    }

    let reducedOrDropped = false;
    const prices: Record<string, number> = {};

    for (const item of guestItems) {
      const variantRows = await tx
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          stock: productVariants.stock,
          active: productVariants.active,
          priceCents: productVariants.priceCents,
        })
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1)
        .for("update");
      const variant = variantRows[0];

      const productRows = variant
        ? await tx
            .select({ active: products.active, basePriceCents: products.basePriceCents })
            .from(products)
            .where(eq(products.id, variant.productId))
            .limit(1)
        : [];

      if (!variant || !variant.active || !productRows[0]?.active || variant.stock <= 0) {
        reducedOrDropped = true;
        continue;
      }

      const existingRows = await tx
        .select({ quantity: cartItems.quantity })
        .from(cartItems)
        .where(and(eq(cartItems.cartId, userCartId), eq(cartItems.variantId, variant.id)))
        .limit(1)
        .for("update");

      const desired = (existingRows[0]?.quantity ?? 0) + item.quantity;
      const capped = Math.min(desired, variant.stock);
      if (capped < desired) {
        reducedOrDropped = true;
      }
      if (capped <= 0) {
        continue;
      }

      await tx
        .insert(cartItems)
        .values({ cartId: userCartId, variantId: variant.id, quantity: capped })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.variantId],
          set: { quantity: capped },
        });

      prices[variant.id] = variant.priceCents ?? productRows[0].basePriceCents;
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, guestCart.id));
    await tx.delete(carts).where(eq(carts.id, guestCart.id));

    return {
      merged: true,
      reducedOrDropped,
      guestItems: guestItems.length,
      prices,
    };
  });

  if (!outcome.merged) {
    // Cookie huérfana (carrito ya fusionado): se limpia sin mostrar avisos.
    await clearCartToken();
    return NOTHING_TO_MERGE;
  }

  await clearCartToken();
  if (outcome.reducedOrDropped) {
    await setCartMergeNotice();
  }

  const snapshot = await readCartPriceSnapshot();
  for (const [variantId, price] of Object.entries(outcome.prices)) {
    snapshot[variantId] ??= price;
  }
  await writeCartPriceSnapshot(snapshot);

  revalidatePath("/", "layout");
  revalidatePath("/carrito");

  return {
    merged: outcome.merged,
    reducedOrDropped: outcome.reducedOrDropped,
    guestItems: outcome.guestItems,
  };
}
