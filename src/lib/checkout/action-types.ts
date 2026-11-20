export type CheckoutField = "shippingMethod" | "addressId" | "newAddress";

export type CheckoutActionResult = {
  ok: boolean;
  message: string | null;
  fieldErrors: Partial<Record<CheckoutField | string, string>>;
  /** Pedido creado aunque fallara MercadoPago: permite reintentar sin duplicarlo. */
  orderId: string | null;
};

export function checkoutFailure(
  message: string,
  fieldErrors: Partial<Record<string, string>> = {},
  orderId: string | null = null,
): CheckoutActionResult {
  return { ok: false, message, fieldErrors, orderId };
}
