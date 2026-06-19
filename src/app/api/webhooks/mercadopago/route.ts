import { NextResponse } from "next/server";
import { env } from "@/core/config/env";
import {
  getPayment,
  verifyWebhookSignature,
} from "@/core/payments/mercadopago";
import { confirmOrderPayment } from "@/features/orders/services/paymentService";

// Webhook de MercadoPago (REST, Cap. 17). Verifica firma, es idempotente y
// responde rápido. El cobro se confirma SOLO acá (nunca desde el navegador).
export async function POST(req: Request) {
  const url = new URL(req.url);

  let body: { type?: string; data?: { id?: string } } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // Algunas notificaciones llegan sin body JSON; usamos los query params.
  }

  const type = url.searchParams.get("type") ?? body.type;
  const dataId = url.searchParams.get("data.id") ?? body.data?.id;

  // Solo nos interesan las notificaciones de pago.
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Verificación de firma (obligatoria cuando hay secret configurado).
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret) {
    const valid = verifyWebhookSignature({
      dataId: String(dataId),
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      secret,
    });
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "firma inválida" },
        {
          status: 401,
        },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    // En producción la firma es obligatoria: sin secret, no procesamos.
    console.error(
      "[webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado en producción.",
    );
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  } else {
    console.warn(
      "[webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado: firma sin verificar (solo dev).",
    );
  }

  try {
    const payment = await getPayment(String(dataId));
    if (payment.status === "approved" && payment.externalReference) {
      await confirmOrderPayment(payment.externalReference);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook] error procesando el pago:", error);
    // 500 → MercadoPago reintenta; confirmOrderPayment es idempotente.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
