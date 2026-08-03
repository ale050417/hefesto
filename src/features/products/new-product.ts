/**
 * "Nuevo lanzamiento" AUTOMÁTICO por fecha (decisión Ale, 2026-07-29).
 *
 * Antes era una casilla que había que tildar a mano en el alta. No tenía
 * sentido —publicar un producto YA es el lanzamiento— y además envejecía mal:
 * si nadie la destildaba, una pieza de hace seis meses seguía diciendo "Nuevo".
 *
 * Ahora se calcula: un producto es nuevo durante sus primeros
 * `NEW_PRODUCT_DAYS` días desde que se creó, y deja de serlo solo.
 *
 * La columna `products.is_new` quedó sin uso (no se lee ni se escribe); se
 * mantiene para no migrar la base.
 */
export const NEW_PRODUCT_DAYS = 30;

/** Fecha de corte: todo lo creado DESPUÉS de este momento es "nuevo". */
export function newSince(now: Date = new Date()): Date {
  const since = new Date(now);
  since.setDate(since.getDate() - NEW_PRODUCT_DAYS);
  return since;
}

/** ¿Este producto todavía lleva el cartel "Nuevo"? */
export function isNewProduct(
  createdAt: Date | string,
  now: Date = new Date(),
): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  // Un `created_at` en el futuro (reloj desfasado) igual cuenta como nuevo.
  return created >= newSince(now).getTime();
}
