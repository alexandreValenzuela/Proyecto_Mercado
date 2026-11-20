import { eq } from "drizzle-orm";
import { getTransactionalDb } from "@/db/transaction";
import { productVariants, stockMovements } from "@/db/schema";
import type { StockAdjustmentInput } from "@/lib/validators/catalog";

export class StockAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockAdjustmentError";
  }
}

/**
 * Actualiza el stock y registra el movimiento en UNA transacción. El bloqueo
 * `FOR UPDATE` evita dos ajustes concurrentes sobre la misma variante y el
 * chequeo del resultado nunca permite stock negativo.
 */
export async function adjustVariantStock(input: StockAdjustmentInput, createdBy: string) {
  const db = getTransactionalDb();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
      .limit(1)
      .for("update");

    const variant = rows[0];
    if (!variant) {
      throw new StockAdjustmentError("No se encontró la variante.");
    }

    const nextStock = variant.stock + input.delta;
    if (nextStock < 0) {
      throw new StockAdjustmentError(
        `No hay stock suficiente. ${variant.sku} tiene ${variant.stock} unidades; el ajuste dejaría ${nextStock}.`,
      );
    }

    await tx
      .update(productVariants)
      .set({ stock: nextStock })
      .where(eq(productVariants.id, variant.id));

    await tx.insert(stockMovements).values({
      variantId: variant.id,
      delta: input.delta,
      reason: input.reason,
      note: input.note || null,
      createdBy,
    });

    return { variantId: variant.id, sku: variant.sku, previousStock: variant.stock, nextStock };
  });
}
