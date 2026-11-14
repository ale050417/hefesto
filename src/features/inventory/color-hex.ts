import { FILAMENT_COLORS } from "./constants";

/**
 * Hex de un color por su nombre, para dibujar el carrete en la app. Primero el
 * del CATÁLOGO (permite colores personalizados); si no está, el de los nombres
 * conocidos; si tampoco, null (la app pone un gris neutro). Insensible a
 * mayúsculas y espacios. Puro y testeable.
 */
export function buildHexResolver(
  catalog: Array<{ name: string; hex: string | null }>,
): (name: string | null | undefined) => string | null {
  const key = (s: string) => s.trim().toLowerCase();
  const fromCatalog = new Map(
    catalog.filter((c) => c.hex).map((c) => [key(c.name), c.hex as string]),
  );
  const known = new Map(FILAMENT_COLORS.map((c) => [key(c.n), c.c]));
  return (name) => {
    if (!name) return null;
    const k = key(name);
    return fromCatalog.get(k) ?? known.get(k) ?? null;
  };
}
