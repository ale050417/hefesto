import type { Delivery } from "./schemas";

/**
 * Cuánto cuesta el envío. Función PURA: entra la entrega elegida + la config
 * del taller + el subtotal, sale el costo. Sin base de datos, sin fechas, sin
 * sorpresas — por eso se puede testear sola y por eso el servidor la usa como
 * única fuente de verdad.
 *
 * Regla que no se negocia (Cap. 13): el precio del envío NUNCA viaja desde el
 * navegador. El cliente manda "soy del barrio San Lucas"; el precio de San
 * Lucas lo pone el servidor. Si viajara desde el navegador, cualquiera podría
 * mandar $0.
 */

export type ShippingZone = { name: string; price: number };

export type ShippingConfig = {
  /** Ciudad del taller (Puerto Iguazú). Vacía = no hay envío local configurado. */
  city: string | null;
  /** Envío gratis a partir de este subtotal. 0 = desactivado. */
  freeOver: number;
  zones: ShippingZone[];
};

export type ShippingQuote = {
  cost: number;
  /** Lo que se le muestra al cliente ("Envío a San Lucas", "Retiro en el local"). */
  label: string;
  /** true si había costo pero se bonificó por superar el mínimo. */
  free: boolean;
};

/** Compara nombres de barrio sin que un acento o una mayúscula rompan todo. */
function igual(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  return norm(a) === norm(b);
}

export function findZone(
  zones: ShippingZone[],
  name: string,
): ShippingZone | null {
  return zones.find((z) => igual(z.name, name)) ?? null;
}

/**
 * @throws con code "ZONE_NOT_FOUND" si el barrio elegido ya no existe (el
 * cliente lo eligió y mientras tanto Ale lo borró de la configuración). Se
 * rechaza en vez de cobrar 0 en silencio: un envío gratis por error es plata.
 */
export function quoteShipping(
  delivery: Delivery,
  config: ShippingConfig,
  subtotal: number,
): ShippingQuote {
  if (delivery.type === "pickup") {
    return { cost: 0, label: "Retiro en el local", free: false };
  }

  if (delivery.type === "national") {
    // Fuera de la ciudad el flete lo paga el comprador directo al correo: no
    // entra en el total del pedido.
    return {
      cost: 0,
      label: "Envío al resto del país (se coordina)",
      free: false,
    };
  }

  const zone = findZone(config.zones, delivery.zone);
  if (!zone) {
    const e = new Error(
      `El barrio "${delivery.zone}" ya no está disponible. Elegí otro.`,
    );
    e.name = "ZONE_NOT_FOUND";
    throw e;
  }

  const base = Math.max(0, Math.round(zone.price * 100) / 100);
  const ciudad = config.city?.trim() || "la ciudad";
  const gratis = config.freeOver > 0 && subtotal >= config.freeOver;

  return {
    cost: gratis ? 0 : base,
    label: gratis
      ? `Envío a ${zone.name} (bonificado)`
      : `Envío a ${zone.name} · ${ciudad}`,
    free: gratis && base > 0,
  };
}

/**
 * Arma el snapshot de dirección que se guarda con el pedido. La ciudad y la
 * provincia de un envío local salen de la CONFIGURACIÓN, no de lo que escriba
 * el cliente: si es de Iguazú, ya sabemos dónde vive.
 */
export function toShippingAddress(
  delivery: Delivery,
  config: ShippingConfig,
): Record<string, string> {
  const ciudad = config.city?.trim() || "";
  const base = {
    fullName: delivery.fullName,
    phone: delivery.phone,
    deliveryType: delivery.type,
    ...(delivery.notes ? { notes: delivery.notes } : {}),
  };

  // Retiro y envío local NO guardan provincia: no se la pedimos al cliente y
  // no la vamos a inventar. La ciudad sale de la configuración del taller.
  if (delivery.type === "pickup") {
    return { ...base, street: "Retiro en el local", city: ciudad };
  }
  if (delivery.type === "local") {
    return {
      ...base,
      street: delivery.street,
      zone: delivery.zone,
      city: ciudad,
    };
  }
  return {
    ...base,
    street: delivery.street,
    city: delivery.city,
    province: delivery.province,
    postalCode: delivery.postalCode,
  };
}
