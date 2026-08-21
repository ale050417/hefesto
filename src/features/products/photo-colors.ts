/**
 * Qué etiquetas de color puede tener una FOTO de este producto.
 *
 * Es la lista que se ofrece al asignarle un color a cada foto, y tiene que dar
 * exactamente lo mismo que elige el cliente en la tienda: si no coinciden
 * letra por letra, la galería nunca encuentra la foto y no salta (bug
 * 2026-08-09, que además se agravaba porque el color se truncaba a 40 chars).
 *
 * - Color único: los colores del producto ("Rojo", "Negro"…).
 * - Multicolor: cada COMBINACIÓN, escrita igual que su variante
 *   ("Negro + Rojo"). Con una sola combinación no hay entre qué saltar.
 *
 * Puro y sin dependencias: lo usan el alta (wizard), la edición y el gestor de
 * imágenes, y así los tres hablan el mismo idioma.
 */
export function photoColorOptions(params: {
  colorMode: "single" | "multi";
  colors: string[];
  /** Etiquetas de las variantes del producto (tamaños o combinaciones). */
  variantLabels: string[];
}): string[] {
  if (params.colorMode === "single") {
    return params.colors.filter((c) => c.trim().length > 0);
  }
  // En multicolor la combinación se guarda como "A + B" en la etiqueta de la
  // variante; solo tiene sentido si hay más de una para elegir.
  const combos = params.variantLabels.filter((l) => l.includes(" + "));
  return combos.length > 1 ? combos : [];
}
