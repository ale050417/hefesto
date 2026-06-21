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
