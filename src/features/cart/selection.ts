/**
 * Qué líneas del carrito entran en ESTE pedido.
 *
 * Existe por "Comprar ahora" desde el catálogo: el cliente toca un producto y
 * espera pagar ESE, no lo que tenía guardado de la semana pasada. Se resuelve
 * con las tildes que ya tiene el checkout (nada se borra del carrito: lo demás
 * queda destildado y sigue ahí).
 *
 * PURA y con test porque decide QUÉ SE COBRA: un fallo acá le cobra al cliente
 * cosas que no pidió, o deja el pedido vacío.
 */

export type LineaCarrito = {
  productId: string;
  variantId: string | null;
  color: string | null;
};

/** Identifica una línea del carrito (mismo criterio que el store). */
export function lineKey(i: LineaCarrito): string {
  return `${i.productId}|${i.variantId ?? ""}|${i.color ?? ""}`;
}

/** Clave de sessionStorage con la línea que el cliente quiere comprar sola. */
export const SOLO_KEY = "hefesto-comprar-solo";

/** Guarda qué se compró para que la pantalla de éxito borre SOLO eso. */
export const COMPRADO_KEY = "hefesto-comprado";

/**
 * Vida de la señal de "Comprar ahora". El viaje del catálogo al checkout es de
 * segundos; se le deja margen por si pasa por el login.
 *
 * Sin vencimiento la señal quedaba huérfana: si alguien sin sesión tocaba
 * "Comprar ahora" y no completaba el login, la clave sobrevivía en la pestaña
 * y, un rato después, un checkout hecho desde el carrito compraba UNA sola
 * línea de tres sin que nadie lo hubiera pedido.
 */
const VIDA_MS = 5 * 60 * 1000;

type Senal = { k: string; t: number };

/** Deja la señal (la lee el checkout una sola vez). */
export function guardarComprarSolo(clave: string, ahora = Date.now()): void {
  try {
    const s: Senal = { k: clave, t: ahora };
    sessionStorage.setItem(SOLO_KEY, JSON.stringify(s));
  } catch {
    // Modo privado o storage lleno: se sigue con el carrito completo.
  }
}

/** Lee y BORRA la señal. Devuelve null si no hay o si ya venció. */
export function tomarComprarSolo(ahora = Date.now()): string | null {
  let crudo: string | null = null;
  try {
    crudo = sessionStorage.getItem(SOLO_KEY);
    if (crudo) sessionStorage.removeItem(SOLO_KEY);
  } catch {
    return null;
  }
  return leerSenal(crudo, ahora);
}

/** Parte pura de `tomarComprarSolo` (lo que se puede testear). */
export function leerSenal(crudo: string | null, ahora: number): string | null {
  if (!crudo) return null;
  try {
    const s = JSON.parse(crudo) as Partial<Senal>;
    if (typeof s.k !== "string" || typeof s.t !== "number") return null;
    if (ahora - s.t > VIDA_MS) return null;
    return s.k;
  } catch {
    return null;
  }
}

/**
 * Líneas que quedan EXCLUIDAS (destildadas) si el cliente vino con "Comprar
 * ahora" de la línea `clave`.
 *
 * Si la clave no está en el carrito (producto borrado, carrito vaciado en otra
 * pestaña) NO se excluye nada: es preferible mostrar el carrito completo y que
 * el cliente elija, antes que dejarlo en un checkout vacío sin explicación.
 */
export function excluidasParaComprarSolo(
  items: LineaCarrito[],
  clave: string | null,
): Set<string> {
  if (!clave) return new Set();
  const claves = items.map(lineKey);
  if (!claves.includes(clave)) return new Set();
  return new Set(claves.filter((k) => k !== clave));
}
