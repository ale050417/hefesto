// Encuadre y orden de imágenes desde la app (pedido de Ale, 2026-11-18: "no me
// deja arrastrar nada cuando cambio banners o fotos"). Puro y sin dependencias:
// lo comparten los banners y las fotos de producto.

/**
 * Encuadre "x% y%" (object-position / background-position) ya saneado: dos
 * porcentajes entre 0 y 100, redondeados. Null si no es un encuadre válido.
 */
export function normalizePosition(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(raw);
  if (!m) return null;
  const clamp = (v: string) =>
    Math.min(100, Math.max(0, Math.round(Number(v))));
  return `${clamp(m[1]!)}% ${clamp(m[2]!)}%`;
}

/**
 * ¿El orden pedido son EXACTAMENTE los mismos elementos que hay, sin repetir
 * ni faltar ninguno? Si entre que se abrió la pantalla y se arrastró alguien
 * sumó o borró uno, no se reordena a ciegas: se rechaza y la app recarga.
 */
export function isSameSet(current: string[], requested: string[]): boolean {
  if (current.length !== requested.length) return false;
  const asked = new Set(requested);
  if (asked.size !== requested.length) return false;
  return current.every((id) => asked.has(id));
}
