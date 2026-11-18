/**
 * Del catálogo de colores, solo los que EXISTEN como filamento cargado (con o
 * sin stock). Pura: se testea.
 *
 * El catálogo es una lista de nombres que se va llenando a mano y junta
 * colores que nunca tuvieron carrete o que se escribieron dos veces ("Bronze"
 * / "Bronce", "Mageta" / "Magenta"). Ofrecerlos al cargar un producto dejaba
 * elegir colores que el taller no tiene (arreglo de Agustín, 2026-11-17).
 */
export function colorsWithFilament<T extends { name: string }>(
  catalog: T[],
  filamentColors: string[],
): T[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const have = new Set(filamentColors.map(norm));
  return catalog.filter((c) => have.has(norm(c.name)));
}
