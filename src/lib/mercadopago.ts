import MercadoPagoConfig, { Payment, Preference } from "mercadopago";

export type MercadoPagoPayment = Awaited<ReturnType<Payment["get"]>>;

export type CheckoutPreferenceLine = {
  id: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
};

type MPConfig = {
  config: MercadoPagoConfig;
  appUrl: URL;
};

/**
 * Las variables se validan en el punto de uso, nunca al importar: con las
 * credenciales vacías el build y el resto del sitio deben seguir funcionando.
 */
function getMercadoPagoConfig(): MPConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error(
      "Falta MP_ACCESS_TOKEN. Configuralo en .env.local con el access token de prueba o de producción de MercadoPago.",
    );
  }

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error("Falta APP_URL. Configuralo en .env.local (por ejemplo, la URL del túnel local).");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL no es una URL válida. Revisá .env.local.");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("APP_URL debe usar http o https. Revisá .env.local.");
  }

  return {
    config: new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } }),
    appUrl: parsedUrl,
  };
}

/**
 * Heurística de mejor esfuerzo, NO una señal confiable del entorno.
 * Los tokens de prueba legacy empiezan con `TEST-`, pero los tokens de prueba
 * actuales de MercadoPago usan el prefijo `APP_USR-`, igual que los de
 * producción. Por lo tanto el prefijo por sí solo no permite distinguir Test
 * de Producción con credenciales modernas: un `true` acá solo significa
 * "podría ser un token de prueba". Nunca se usa para elegir la URL de checkout;
 * la señal autoritativa es la respuesta de la API (`sandbox_init_point` solo
 * aparece cuando las credenciales están en modo Test).
 */
export function isSandboxAccessToken(accessToken: string): boolean {
  return accessToken.startsWith("TEST-") || accessToken.startsWith("APP_USR-");
}

export function getWebhookSecret(): string {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Falta MP_WEBHOOK_SECRET. Configurá la firma del webhook en .env.local para validar las notificaciones.",
    );
  }
  return secret;
}

function resultUrl(appUrl: URL, orderId: string, status: "approved" | "pending" | "failure"): string {
  const url = new URL("/checkout/resultado", appUrl);
  url.searchParams.set("order", orderId);
  url.searchParams.set("status", status);
  return url.toString();
}

export type CreatedPreference = {
  preferenceId: string | null;
  checkoutUrl: string;
};

/** Crea la preferencia de Checkout Pro sobre un pedido ya persistido. */
export async function createCheckoutPreference(input: {
  orderId: string;
  lines: CheckoutPreferenceLine[];
  payerEmail: string | null;
}): Promise<CreatedPreference> {
  const { config, appUrl } = getMercadoPagoConfig();

  const preference = await new Preference(config).create({
    body: {
      items: input.lines.map((line) => ({
        id: line.id,
        title: line.title,
        quantity: line.quantity,
        // Los importes se guardan en centavos; la API los espera en pesos.
        unit_price: line.unitPriceCents / 100,
        currency_id: "ARS",
      })),
      external_reference: input.orderId,
      back_urls: {
        success: resultUrl(appUrl, input.orderId, "approved"),
        pending: resultUrl(appUrl, input.orderId, "pending"),
        failure: resultUrl(appUrl, input.orderId, "failure"),
      },
      auto_return: "approved",
      notification_url: new URL("/api/webhooks/mercadopago", appUrl).toString(),
      ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
    },
  });

  // MP devuelve sandbox_init_point solo con credenciales en modo Test. Esa es
  // la señal autoritativa: funciona igual con tokens legacy `TEST-` y con los
  // modernos `APP_USR-`, que comparten prefijo con producción.
  const checkoutUrl = preference.sandbox_init_point ?? preference.init_point;
  if (!checkoutUrl) {
    throw new Error("MercadoPago no devolvió una URL de pago. Intentá de nuevo en unos minutos.");
  }

  return { preferenceId: preference.id ?? null, checkoutUrl };
}

/** Nunca se usa el cuerpo del webhook para conocer el estado del pago. */
export async function fetchMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const { config } = getMercadoPagoConfig();
  return new Payment(config).get({ id: paymentId });
}
