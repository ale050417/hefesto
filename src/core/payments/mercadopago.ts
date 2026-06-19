import crypto from "node:crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { env } from "@/core/config/env";

// Adapter: envolvemos el SDK de MercadoPago tras una interfaz propia, para que
// el resto de la app no dependa directamente del tercero (Cap. 6).

export type PreferenceItem = {
  title: string;
  quantity: number;
  unitPrice: number;
};

export type CreatePreferenceParams = {
  // Referencia para mapear el pago al pedido en el webhook (id del pedido).
  externalReference: string;
  items: PreferenceItem[];
  backUrls: { success: string; failure: string; pending: string };
  notificationUrl?: string;
  payerEmail?: string;
};

export type CreatedPreference = { id: string; initPoint: string };

// Cuerpo de la preferencia. Función PURA → testeable sin tocar la red.
export function buildPreferenceBody(p: CreatePreferenceParams) {
  return {
    items: p.items.map((it, idx) => ({
      id: `${p.externalReference}-${idx}`,
      title: it.title,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      currency_id: "ARS",
    })),
    external_reference: p.externalReference,
    back_urls: p.backUrls,
    auto_return: "approved" as const,
    ...(p.notificationUrl ? { notification_url: p.notificationUrl } : {}),
    ...(p.payerEmail ? { payer: { email: p.payerEmail } } : {}),
  };
}

let preferenceClient: Preference | null = null;
function getPreferenceClient(): Preference {
  if (!preferenceClient) {
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
    }
    const config = new MercadoPagoConfig({
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    });
    preferenceClient = new Preference(config);
  }
  return preferenceClient;
}

/** Crea la preferencia en MercadoPago y devuelve su id + init_point. */
export async function createPreference(
  p: CreatePreferenceParams,
): Promise<CreatedPreference> {
  const res = await getPreferenceClient().create({
    body: buildPreferenceBody(p),
  });
  if (!res.id || !res.init_point) {
    throw new Error("MercadoPago no devolvió init_point.");
  }
  return { id: res.id, initPoint: res.init_point };
}

/**
 * Verifica la firma del webhook (header x-signature "ts=...,v1=..."). El
 * manifest sigue el formato de MercadoPago y se compara en tiempo constante.
 * Función pura → testeable.
 */
export function verifyWebhookSignature(params: {
  dataId: string;
  xSignature: string | null;
  xRequestId: string | null;
  secret: string;
}): boolean {
  if (!params.xSignature) return false;
  const parts: Record<string, string> = {};
  for (const segment of params.xSignature.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = `id:${params.dataId.toLowerCase()};`;
  if (params.xRequestId) manifest += `request-id:${params.xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto
    .createHmac("sha256", params.secret)
    .update(manifest)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let paymentClient: Payment | null = null;
function getPaymentClient(): Payment {
  if (!paymentClient) {
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
    }
    const config = new MercadoPagoConfig({
      accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    });
    paymentClient = new Payment(config);
  }
  return paymentClient;
}

/** Consulta un pago en MercadoPago por id (estado + referencia al pedido). */
export async function getPayment(
  id: string,
): Promise<{ status: string | null; externalReference: string | null }> {
  const res = await getPaymentClient().get({ id });
  return {
    status: res.status ?? null,
    externalReference: res.external_reference ?? null,
  };
}
