/**
 * A quién le pertenece el estado guardado en el navegador (carrito, cupón,
 * favoritos, señales del checkout).
 *
 * El carrito vive en localStorage, así que sobrevive al cierre de sesión: sin
 * esto, el que se logueaba después en la misma compu se encontraba con el
 * carrito del anterior. En una compu compartida (o el mostrador del local) eso
 * es un problema de privacidad, no solo de prolijidad.
 *
 * PURA y con test porque decide cuándo se borra lo que el cliente cargó.
 */

/** Clave de localStorage con el dueño del estado local. */
export const OWNER_KEY = "hefesto-sesion";

export type AccionSesion = "nada" | "adoptar" | "limpiar";

/**
 * Qué hacer al cargar la tienda, comparando el dueño guardado con quien está
 * navegando ahora.
 *
 * - `usuario` = id → esa persona.
 * - `usuario` = null → el servidor CONFIRMA que no hay sesión.
 * - `usuario` = undefined → no se pudo verificar (Supabase caído, token que el
 *   middleware no pudo refrescar). En ese caso **no se toca nada**: tratar el
 *   "no sé" como "cerró sesión" le borraría el carrito a alguien que sigue
 *   logueado, y eso no tiene vuelta atrás.
 *
 * Reglas:
 * - Mismo usuario → **nada**.
 * - Nadie guardado y ahora hay sesión → **adoptar**: el carrito que armó antes
 *   de iniciar sesión es suyo y sería hostil borrárselo justo al loguearse.
 * - Cualquier otro cambio (se fue, o entró otra persona) → **limpiar**.
 */
export function decidirSesion(
  dueño: string | null,
  usuario: string | null | undefined,
): AccionSesion {
  if (usuario === undefined) return "nada";
  const guardado = dueño?.trim() ? dueño.trim() : null;
  if (guardado === usuario) return "nada";
  if (guardado === null) return usuario === null ? "nada" : "adoptar";
  return "limpiar";
}
