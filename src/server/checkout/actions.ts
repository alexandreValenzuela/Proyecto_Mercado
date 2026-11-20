"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { findOrderForUser } from "@/db/queries/orders";
import { z } from "zod";
import { AuthorizationError, requireUser } from "@/lib/auth/helpers";
import { checkoutFailure, checkoutSuccess, type CheckoutActionResult } from "@/lib/checkout/action-types";
import { createCheckoutSchema } from "@/lib/validators/checkout";
import { checkoutErrorMessage, createPendingOrder, createPreferenceForOrder } from "@/server/checkout/order-service";

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "form";
    errors[field] ??= issue.message;
  }
  return errors;
}

function signedOutResult(): CheckoutActionResult {
  return checkoutFailure("Iniciá sesión para continuar con el pago.");
}

/** Crea el pedido en una transacción y redirige al checkout de MercadoPago. */
export async function createCheckout(input: unknown): Promise<CheckoutActionResult> {
  let sessionUserId: string;
  try {
    sessionUserId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return signedOutResult();
    }
    throw error;
  }

  const parsed = createCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return checkoutFailure("Revisá los datos del envío.", fieldErrorsFrom(parsed.error));
  }

  let orderId: string | null = null;
  let checkoutUrl: string;
  try {
    const outcome = await createPendingOrder(sessionUserId, parsed.data);
    if (!outcome.ok) {
      return checkoutFailure(outcome.message, outcome.fieldErrors ?? {});
    }
    orderId = outcome.orderId;
    checkoutUrl = await createPreferenceForOrder(orderId);
  } catch (error) {
    return checkoutFailure(checkoutErrorMessage(error, orderId), {}, orderId);
  }

  revalidatePath("/cuenta/pedidos");
  revalidatePath("/carrito");
  return checkoutSuccess(checkoutUrl, orderId);
}

const retryPaymentSchema = z.object({ orderId: z.uuid("No se encontró el pedido.") });

/** Reutiliza el mismo pedido pendiente: no crea uno nuevo ni descuenta stock. */
export async function retryPayment(input: unknown): Promise<CheckoutActionResult> {
  const parsed = retryPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return checkoutFailure("No se encontró el pedido.", fieldErrorsFrom(parsed.error));
  }

  let sessionUserId: string;
  try {
    sessionUserId = (await requireUser()).user.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return signedOutResult();
    }
    throw error;
  }

  const order = await findOrderForUser(sessionUserId, parsed.data.orderId);
  if (!order) {
    return checkoutFailure("No encontramos ese pedido en tu cuenta.");
  }
  if (order.status !== "pending_payment") {
    return checkoutFailure("Este pedido ya no admite pagos. Revisá el estado en Mis pedidos.");
  }

  let checkoutUrl: string;
  try {
    checkoutUrl = await createPreferenceForOrder(order.id);
  } catch (error) {
    return checkoutFailure(checkoutErrorMessage(error, order.id), {}, order.id);
  }

  revalidatePath("/cuenta/pedidos");
  return checkoutSuccess(checkoutUrl, order.id);
}
