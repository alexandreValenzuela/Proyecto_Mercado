import {
  hasRecentProductView,
  insertProductView,
  productExists,
} from "@/db/queries/catalog";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Registra a lo sumo una visita por visitante/producto/hora. El token de
 * visitante viene de una cookie httpOnly; el usuario se guarda cuando hay sesión.
 */
export async function recordProductView(input: {
  productId: string;
  sessionToken: string;
  userId: string | null;
}) {
  if (!input.sessionToken || input.sessionToken.length < 8) {
    return { recorded: false, reason: "invalid_token" as const };
  }

  if (!(await productExists(input.productId))) {
    return { recorded: false, reason: "product_not_found" as const };
  }

  const since = new Date(Date.now() - ONE_HOUR_MS);
  if (
    await hasRecentProductView({
      productId: input.productId,
      sessionToken: input.sessionToken,
      since,
    })
  ) {
    return { recorded: false, reason: "throttled" as const };
  }

  await insertProductView({
    productId: input.productId,
    sessionToken: input.sessionToken,
    userId: input.userId,
  });

  return { recorded: true, reason: "recorded" as const };
}
