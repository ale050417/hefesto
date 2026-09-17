// Etiqueta de un carrete para los selectores (PURA: se usa en cliente y se testea).

export type FilamentLabelParts = {
  material: string;
  color: string;
  brand?: string | null;
};

/**
 * "PLA · Rojo · Grilon3" — la MARCA va en la etiqueta porque el material y el
 * color no alcanzan para reconocer el carrete: con tres rojos cargados, el
 * selector mostraba tres opciones idénticas y había que adivinar (pedido de
 * Ale, 2026-09). Marca vacía → se omite el segmento (no deja un "·" colgado).
 */
export function filamentTag(f: FilamentLabelParts): string {
  const brand = f.brand?.trim();
  return [f.material, f.color, brand || null].filter(Boolean).join(" · ");
}
