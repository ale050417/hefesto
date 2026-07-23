import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { db } from "@/core/db";
import { paymentSettings } from "@/core/db/schema/payment-settings";
import { env } from "@/core/config/env";
import { pickMpAccessToken } from "./mp-token";

// Adapter: envolvemos el SDK de MercadoPago tras una interfaz propia, para que
// el resto de la app no dependa directamente del tercero (Cap. 6).

/** Access Token activo: el del panel (DB) con fallback al de entorno. */
export async function getActiveMpAccessToken(): Promise<string | null> {
  let dbToken: string | null = null;
  try {
    const [row] = await db
      .select({ token: paymentSettings.mpAccessToken })
      .from(paymentSettings)
      .where(eq(paymentSettings.id, 1));
    dbToken = row?.token ?? null;
  } catch {
    // Si la DB no responde, caemos al token de entorno.
  }
  return pickMpAccessToken(dbToken, env.MERCADOPAGO_ACCESS_TOKEN);
}

/** True si MercadoPago está conectado (token en el panel o en el entorno). */
export async function isMercadoPagoConfigured(): Promise<boolean> {
  return Boolean(await getActiveMpAccessToken());
}

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

/**
 * True si la URL es local/no pública (localhost, IPs de loopback, *.local).
 * MercadoPago RECHAZA la preferencia si mandamos `auto_return` con back_urls
 * que apuntan a localhost (típico en dev). Función PURA → testeable.
 */
export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    // Si no parsea, no arriesgamos auto_return.
    return true;
  }
}

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
    // auto_return solo con URL pública: en localhost MP lo rechaza y rompe el
    // checkout. En producción (dominio real) se incluye y vuelve solo al sitio.
    ...(isLocalUrl(p.backUrls.success)
      ? {}
      : { auto_return: "approved" as const }),
    // notification_url solo si es pública: un webhook a localhost es inútil
    // (MP no puede alcanzarlo) y encima puede hacer que MP rechace la preferencia.
    ...(p.notificationUrl && !isLocalUrl(p.notificationUrl)
      ? { notification_url: p.notificationUrl }
      : {}),
    ...(p.payerEmail ? { payer: { email: p.payerEmail } } : {}),
  };
}

/**
 * Traduce un error del SDK de MercadoPago a un motivo corto y legible
 * (status + descripción de la API). Sirve para mostrar POR QUÉ falló la
 * creación de la preferencia (token inválido, credenciales sin activar, etc.)
 * en vez de un genérico opaco. Función PURA → testeable. No expone secretos.
 */
export function describeMpError(error: unknown): string {
  if (error == null) return "error desconocido";
  if (typeof error === "string") return error.slice(0, 200);
  if (typeof error !== "object") return String(error).slice(0, 200);

  const e = error as {
    status?: unknown;
    message?: unknown;
    cause?: unknown;
    error?: unknown;
  };
  const parts: string[] = [];

  if (typeof e.status === "number" || typeof e.status === "string") {
    parts.push(`status ${e.status}`);
  }

  // cause: puede ser [{ code, description }] (formato típico de la API) u objeto.
  const cause = e.cause;
  if (Array.isArray(cause) && cause.length > 0) {
    const first = cause[0] as { description?: unknown; code?: unknown };
    if (first?.description) parts.push(String(first.description));
    else if (first?.code) parts.push(`code ${first.code}`);
  } else if (cause && typeof cause === "object") {
    const c = cause as { message?: unknown; description?: unknown };
    if (c.description) parts.push(String(c.description));
    else if (c.message) parts.push(String(c.message));
  }

  // Fallbacks: mensaje del error o el campo `error` de la API.
  if (parts.length === 0 && typeof e.message === "string" && e.message) {
    parts.push(e.message);
  }
  if (parts.length === 0 && typeof e.error === "string" && e.error) {
    parts.push(e.error);
  }

  return (parts.join(" · ") || "error desconocido").slice(0, 200);
}

// El token puede cambiar (lo edita el vendedor en el panel), así que NO
// cacheamos el cliente: lo resolvemos por llamada. Instanciar el SDK es barato.
function mpConfig(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({
    // Anti-cuelgue: si MP no responde, cortamos nosotros (no Vercel a los 300 s).
    options: { timeout: 15_000 },
    accessToken,
  });
}

/** Crea la preferencia en MercadoPago y devuelve su id + init_point. */
export async function createPreference(
  p: CreatePreferenceParams,
): Promise<CreatedPreference> {
  const token = await getActiveMpAccessToken();
  if (!token) throw new Error("MercadoPago no está conectado.");
  const res = await new Preference(mpConfig(token)).create({
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

/** Consulta un pago en MercadoPago por id (estado + referencia al pedido). */
export async function getPayment(
  id: string,
): Promise<{ status: string | null; externalReference: string | null }> {
  const token = await getActiveMpAccessToken();
  if (!token) throw new Error("MercadoPago no está conectado.");
  const res = await new Payment(mpConfig(token)).get({ id });
  return {
    status: res.status ?? null,
    externalReference: res.external_reference ?? null,
  };
}
