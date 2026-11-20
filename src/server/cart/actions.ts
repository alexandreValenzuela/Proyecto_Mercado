"use server";

import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import type { ZodError } from "zod";
import {
  countCartItems,
  deleteCartItem,
  ensureCart,
  findCartId,
  findCartItemByVariant,
  findOwnedCartItem,
  findVariantForCart,
  getCartItems,
  setCartItemQuantity,
  upsertCartItem,
  type CartIdentity,
} from "@/db/queries/cart";
import {
  clearCartMergeNotice,
  readCartPriceSnapshot,
  removeCartPriceSnapshot,
  writeCartPriceSnapshot,
} from "@/lib/cart/token";
import { getStockState } from "@/lib/catalog/stock";
import {
  emptyCartSummary,
  type CartActionResult,
  type CartSummary,
  type CartSummaryItem,
} from "@/lib/cart/types";
import { formatMoney } from "@/lib/money";
import {
  addToCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/lib/validators/cart";
import { getCartIdentity } from "@/server/cart/identity";
import { mergeGuestCartIntoUserCart } from "@/server/cart/merge";

function fieldErrorsFrom(error: ZodError): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

function result(
  status: CartActionResult["status"],
  message: string,
  itemCount: number,
  fieldErrors: Partial<Record<string, string>> = {},
): CartActionResult {
  return { ok: status !== "error", status, message, itemCount, fieldErrors };
}

function revalidateCart(): void {
  // "layout" alcanza al contador del navbar en todas las rutas del storefront.
  revalidatePath("/", "layout");
  revalidatePath("/carrito");
}

async function identityWithMerge(): Promise<CartIdentity> {
  const identity = await getCartIdentity({ createToken: true });
  if (identity.userId) {
    // Si quedó una cookie invitada de un login anterior, se recupera acá mismo.
    await mergeGuestCartIntoUserCart(identity.userId);
  }
  return identity;
}

export async function addToCart(variantId: unknown, quantity: unknown): Promise<CartActionResult> {
  const parsed = addToCartSchema.safeParse({ variantId, quantity });
  if (!parsed.success) {
    return result("error", "Revisá los datos del producto.", 0, fieldErrorsFrom(parsed.error));
  }

  try {
    const identity = await identityWithMerge();
    const cart = await ensureCart(identity);
    const variant = await findVariantForCart(parsed.data.variantId);

    if (!variant || !variant.variantActive || !variant.productActive) {
      return result("error", "Este producto ya no está disponible.", 0);
    }
    if (variant.stock <= 0) {
      return result("error", "Sin stock. Probá con otra variante.", 0);
    }

    const existing = await findCartItemByVariant(cart.id, variant.id);
    const desired = (existing?.quantity ?? 0) + parsed.data.quantity;
    const finalQuantity = Math.min(desired, variant.stock);
    await upsertCartItem(cart.id, variant.id, finalQuantity);

    const prices = await readCartPriceSnapshot();
    prices[variant.id] ??= variant.priceCents ?? variant.basePriceCents;
    await writeCartPriceSnapshot(prices);

    revalidateCart();
    const itemCount = await countCartItems(cart.id);

    if (finalQuantity < desired) {
      return result(
        "warning",
        `Pocas unidades disponibles: hay ${variant.stock}. Ajustamos la cantidad a ${finalQuantity}.`,
        itemCount,
      );
    }

    return result(
      "success",
      existing ? "Actualizamos la cantidad en tu carrito." : "Agregado al carrito.",
      itemCount,
    );
  } catch (error) {
    console.error("addToCart", error);
    return result("error", "No se pudo agregar el producto. Intentá de nuevo.", 0);
  }
}

export async function updateCartItem(itemId: unknown, quantity: unknown): Promise<CartActionResult> {
  const parsed = updateCartItemSchema.safeParse({ itemId, quantity });
  if (!parsed.success) {
    return result("error", "Revisá la cantidad elegida.", 0, fieldErrorsFrom(parsed.error));
  }

  try {
    const identity = await getCartIdentity();
    const cartId = await findCartId(identity);
    if (!cartId) {
      return result("error", "No encontramos tu carrito.", 0);
    }

    const item = await findOwnedCartItem(parsed.data.itemId, cartId);
    if (!item) {
      return result("error", "No encontramos ese ítem en tu carrito.", 0);
    }

    const variant = await findVariantForCart(item.variantId);
    if (!variant || !variant.variantActive || !variant.productActive) {
      return result("error", "Este producto ya no está disponible.", 0);
    }
    if (variant.stock <= 0) {
      return result("error", "Sin stock. Sacá este producto del carrito.", 0);
    }

    const finalQuantity = Math.min(parsed.data.quantity, variant.stock);
    await setCartItemQuantity(item.id, cartId, finalQuantity);
    revalidateCart();
    const itemCount = await countCartItems(cartId);

    if (finalQuantity < parsed.data.quantity) {
      return result(
        "warning",
        `Pocas unidades disponibles: hay ${variant.stock}. Ajustamos la cantidad a ${finalQuantity}.`,
        itemCount,
      );
    }

    return result("success", "Cantidad actualizada.", itemCount);
  } catch (error) {
    console.error("updateCartItem", error);
    return result("error", "No se pudo actualizar la cantidad. Intentá de nuevo.", 0);
  }
}

export async function removeCartItem(itemId: unknown): Promise<CartActionResult> {
  const parsed = removeCartItemSchema.safeParse({ itemId });
  if (!parsed.success) {
    return result("error", "No se encontró el ítem del carrito.", 0, fieldErrorsFrom(parsed.error));
  }

  try {
    const identity = await getCartIdentity();
    const cartId = await findCartId(identity);
    if (!cartId) {
      return result("error", "No encontramos tu carrito.", 0);
    }

    const item = await findOwnedCartItem(parsed.data.itemId, cartId);
    if (!item) {
      return result("error", "No encontramos ese ítem en tu carrito.", 0);
    }

    await deleteCartItem(item.id, cartId);
    await removeCartPriceSnapshot(item.variantId);
    revalidateCart();

    return result("success", "Producto quitado del carrito.", await countCartItems(cartId));
  } catch (error) {
    console.error("removeCartItem", error);
    return result("error", "No se pudo quitar el producto. Intentá de nuevo.", 0);
  }
}

export async function dismissCartMergeNotice(): Promise<void> {
  await clearCartMergeNotice();
}

export async function getCartSummary(): Promise<CartSummary> {
  // auth() genera un token CSRF aleatorio; con PPR hay diferir a request time
  // (el navbar y /carrito ya tienen Suspense boundary).
  await connection();
  const identity = await getCartIdentity();
  const cartId = await findCartId(identity);
  if (!cartId) {
    return emptyCartSummary;
  }

  const [rows, snapshot] = await Promise.all([getCartItems(cartId), readCartPriceSnapshot()]);
  const warnings: string[] = [];
  let subtotalCents = 0;
  let itemCount = 0;

  const items: CartSummaryItem[] = rows.map((row) => {
    const { variant } = row;
    const { product } = variant;
    const unitPriceCents = variant.priceCents ?? product.basePriceCents;
    const addedPriceCents = snapshot[variant.id] ?? null;
    const available = variant.active && product.active;
    const stockState = getStockState(variant.stock, variant.lowStockThreshold);
    const lineTotalCents = unitPriceCents * row.quantity;

    subtotalCents += lineTotalCents;
    itemCount += row.quantity;

    let stockWarning: string | null = null;
    if (!available) {
      stockWarning = "Este producto ya no está disponible. Sacalo del carrito para seguir.";
    } else if (variant.stock <= 0) {
      stockWarning = "Sin stock. Sacalo del carrito o elegí otra variante.";
    } else if (row.quantity > variant.stock) {
      stockWarning = `Solo quedan ${variant.stock} unidades. Ajustá la cantidad.`;
    } else if (stockState === "low") {
      stockWarning = `Pocas unidades disponibles (${variant.stock}).`;
    }

    let priceWarning: string | null = null;
    if (addedPriceCents != null && addedPriceCents !== unitPriceCents) {
      priceWarning = `El precio cambió desde que lo agregaste: era ${formatMoney(addedPriceCents)} y ahora es ${formatMoney(unitPriceCents)}.`;
    }

    for (const warning of [stockWarning, priceWarning]) {
      if (warning && !warnings.includes(warning)) {
        warnings.push(warning);
      }
    }

    return {
      id: row.id,
      variantId: variant.id,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      imageUrl: product.images[0]?.url ?? null,
      unitPriceCents,
      addedPriceCents,
      quantity: row.quantity,
      lineTotalCents,
      stock: variant.stock,
      stockState,
      stockWarning,
      priceWarning,
      available,
    };
  });

  return { items, itemCount, subtotalCents, warnings };
}
