export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const siteName = "Hefesto 3D";

// Teléfono de WhatsApp en formato internacional sin "+" ni espacios
// (ej: 5493815551234). Configurable por env; editable desde el admin
// cuando se amplíe la configuración del negocio.
export const whatsappPhone = (
  process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? ""
).replace(/\D/g, "");

export function whatsappUrl(message?: string): string {
  const base = whatsappPhone
    ? `https://wa.me/${whatsappPhone}`
    : "https://wa.me/";
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Arma el link de WhatsApp priorizando el número configurado en el admin
 * (Config → Negocio); si no hay, cae al de la variable de entorno. Mismo
 * criterio que usa el botón flotante de contacto (WhatsappFab) — reusado acá
 * para la "Vidriera digital" (consultar en vez de comprar).
 */
export function buildWhatsappUrl(
  phone: string | null | undefined,
  message?: string,
): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return whatsappUrl(message);
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;
}
