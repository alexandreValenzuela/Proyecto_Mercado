import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cartItems, carts, productVariants, products } from "@/db/schema";

export type CartIdentity = {
  userId: string | null;
  sessionToken: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "23505" || message.includes("duplicate key");
}

function cartCondition(identity: CartIdentity) {
  if (identity.userId) {
    return eq(carts.userId, identity.userId);
  }
  if (identity.sessionToken) {
    return eq(carts.sessionToken, identity.sessionToken);
  }
  return null;
}

export async function findCartByUserId(userId: string) {
  const rows = await getDb().select().from(carts).where(eq(carts.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function findCartBySessionToken(sessionToken: string) {
  const rows = await getDb()
    .select()
    .from(carts)
    .where(eq(carts.sessionToken, sessionToken))
    .limit(1);
  return rows[0] ?? null;
}

/** Solo lectura: devuelve null si todavía no existe el carrito de esta identidad. */
export async function findCartId(identity: CartIdentity): Promise<string | null> {
  const condition = cartCondition(identity);
  if (!condition) {
    return null;
  }

  const rows = await getDb()
    .select({ id: carts.id })
    .from(carts)
    .where(condition)
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Find-or-create; el upsert con DO NOTHING cubre dos solicitudes simultáneas. */
export async function ensureCart(identity: CartIdentity) {
  const condition = cartCondition(identity);
  if (!condition) {
    throw new Error("No hay una identidad válida para el carrito.");
  }

  const db = getDb();
  const existing = await db.select().from(carts).where(condition).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const values = identity.userId
    ? { userId: identity.userId, sessionToken: null }
    : { userId: null, sessionToken: identity.sessionToken! };

  try {
    const created = await db.insert(carts).values(values).returning();
    return created[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      const retry = await db.select().from(carts).where(condition).limit(1);
      if (retry[0]) {
        return retry[0];
      }
    }
    throw error;
  }
}

export type CartItemWithProduct = Awaited<ReturnType<typeof getCartItems>>[number];

/** Relaciones anidadas: variante -> producto -> primera imagen, en una consulta. */
export async function getCartItems(cartId: string) {
  const cart = await getDb().query.carts.findFirst({
    where: eq(carts.id, cartId),
    with: {
      items: {
        orderBy: (item, { asc: orderAsc }) => orderAsc(item.createdAt),
        with: {
          variant: {
            with: {
              product: {
                with: {
                  images: {
                    orderBy: (image, { asc: orderAsc }) => orderAsc(image.position),
                    limit: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return cart?.items ?? [];
}

export async function findVariantForCart(variantId: string) {
  const rows = await getDb()
    .select({
      id: productVariants.id,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      sku: productVariants.sku,
      label: productVariants.label,
      stock: productVariants.stock,
      variantActive: productVariants.active,
      productActive: products.active,
      priceCents: productVariants.priceCents,
      basePriceCents: products.basePriceCents,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findCartItemByVariant(cartId: string, variantId: string) {
  const rows = await getDb()
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
    .limit(1);
  return rows[0] ?? null;
}

/** La unicidad del par (cartId, itemId) garantiza que nadie toque un carrito ajeno. */
export async function findOwnedCartItem(itemId: string, cartId: string) {
  const rows = await getDb()
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      variantId: cartItems.variantId,
    })
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCartItem(cartId: string, variantId: string, quantity: number) {
  await getDb()
    .insert(cartItems)
    .values({ cartId, variantId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.variantId],
      set: { quantity },
    });
}

export async function setCartItemQuantity(itemId: string, cartId: string, quantity: number) {
  const rows = await getDb()
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning({ id: cartItems.id });
  return rows[0] ?? null;
}

export async function deleteCartItem(itemId: string, cartId: string) {
  const rows = await getDb()
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning({ id: cartItems.id });
  return rows[0] ?? null;
}

export async function countCartItems(cartId: string): Promise<number> {
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return rows[0]?.total ?? 0;
}
