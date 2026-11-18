// Compartir un producto (pedido de Antonella, 2026-11-18: "un botón de
// compartir en los productos porque si no no podemos compartir por wpp").
// Puro y sin dependencias: lo usan la tienda y el panel.

/** Link público del producto. `base` sin barra final (siteUrl). */
export function productShareLink(base: string, slug: string): string {
  return `${base.replace(/\/+$/, "")}/producto/${slug}`;
}

/** El mensaje que se manda: nombre, precio (si se pasa) y el link. */
export function productShareText(p: {
  name: string;
  link: string;
  /** Precio ya formateado ("$8.500"). */
  price?: string | null;
}): string {
  const head = p.price ? `${p.name} — ${p.price}` : p.name;
  return `${head}\n${p.link}`;
}

/**
 * WhatsApp SIN número: abre la lista de chats para elegir a quién mandárselo
 * (un cliente, un grupo). No es el link de "consultar", que va al negocio.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
