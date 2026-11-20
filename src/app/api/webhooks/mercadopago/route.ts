import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { NextResponse } from "next/server";
import { getWebhookSecret } from "@/lib/mercadopago";
import { processPaymentWebhook } from "@/server/checkout/webhook-service";

type NotificationBody = {
  type?: unknown;
  action?: unknown;
  data?: { id?: unknown };
};

function notificationAction(body: NotificationBody): string {
  const value = typeof body.type === "string" ? body.type : body.action;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "payment";
}

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getWebhookSecret();
  } catch (error) {
    console.error("webhook: configuración incompleta", error);
    return NextResponse.json(
      { received: false, error: "El webhook no está configurado. Revisá MP_WEBHOOK_SECRET y APP_URL." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id")?.trim() ?? "";
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!dataId) {
    return NextResponse.json({ received: false, error: "Falta data.id." }, { status: 400 });
  }

  try {
    /*
     * Template oficial (docs de MercadoPago):
     *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
     * HMAC-SHA256 en hex con MP_WEBHOOK_SECRET. El validator del SDK lo aplica
     * con comparación en tiempo constante. No se pasa `toleranceSeconds`: el
     * header `ts` de MP viene en milisegundos y el SDK lo interpreta en segundos.
     */
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      console.warn("webhook: firma inválida", error.reason, error.requestId);
      return NextResponse.json({ received: false, error: "Firma inválida." }, { status: 401 });
    }
    console.error("webhook: error validando firma", error);
    return NextResponse.json({ received: false, error: "No se pudo validar la notificación." }, { status: 400 });
  }

  let body: NotificationBody = {};
  try {
    const raw = await request.text();
    if (raw) {
      body = JSON.parse(raw) as NotificationBody;
    }
  } catch {
    // La firma ya autenticó el origen; el id de la query alcanza para consultar MP.
    body = {};
  }

  const action = notificationAction(body);
  // MercadoPago también notifica otros objetos; este endpoint solo procesa pagos.
  if (action !== "payment" && !action.startsWith("payment.")) {
    console.info("webhook: notificación ignorada por tipo", dataId, action);
    return NextResponse.json({ received: true, outcome: "ignored" });
  }

  try {
    const outcome = await processPaymentWebhook({
      dataId,
      action,
      payload: {
        type: typeof body.type === "string" ? body.type : null,
        action: typeof body.action === "string" ? body.action : null,
      },
    });
    console.info("webhook: notificación procesada", dataId, outcome);
    // Siempre 200 cuando la firma es válida y el evento quedó registrado.
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.error("webhook: error procesando notificación", dataId, error);
    return NextResponse.json(
      { received: false, error: "No se pudo procesar la notificación. Se reintentará." },
      { status: 500 },
    );
  }
}
