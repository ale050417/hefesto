"use client";

import { useState } from "react";
import { saleUnitPrice } from "@/features/products/pricing";
import type { ChooserProduct } from "./types";

export type { ChooserProduct, ChooserVariant } from "./types";

export type ProductChoice = ReturnType<typeof useProductChoice>;

/**
 * Elección de tamaño / color / cantidad de un producto, con su precio.
 *
 * Vive acá y no dentro de un componente porque lo usan DOS pantallas: la página
 * del producto y el modal rápido del catálogo. Si cada una calculara su precio,
 * tarde o temprano mostrarían números distintos para lo mismo — y una de las dos
 * estaría mintiendo. El precio sale de `saleUnitPrice`, la MISMA función pura
 * que usa el servidor para cobrar (y la venta manual), así la pantalla y el
 * cobro no pueden divergir.
 */
export function useProductChoice(product: ChooserProduct) {
  const isMulti = product.colorMode === "multi";
  const [variantId, setVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [color, setColor] = useState<string | null>(
    !isMulti ? (product.colors[0] ?? null) : null,
  );
  const [qty, setQty] = useState(1);

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const basePrice =
    product.isOnSale && product.salePrice != null
      ? product.salePrice
      : product.price;
  /** Precio antes de resolver el color (para saber si el color lo cambia). */
  const beforeColor = Math.max(0, selected?.price ?? basePrice);

  const unitPrice = saleUnitPrice({
    basePrice,
    colorMode: product.colorMode,
    productColorPrices: product.colorPrices,
    variant: selected,
    color,
  });

  /** ¿La variante elegida es una COMBINACIÓN de colores ("Negro + Rojo")? */
  const isCombo = isMulti && selected != null && selected.label.includes(" + ");
  /** ¿Los tamaños son en realidad combinaciones? (define el título del selector) */
  const variantsAreCombos =
    isMulti && product.variants.some((v) => v.label.includes(" + "));

  /** Colores que se ofrecen: los del combo elegido, o los del producto. */
  const colorChoices =
    isCombo && selected
      ? selected.label.split(" + ").map((x) => x.trim())
      : product.colors;

  /** Precio propio de un color (celda de la matriz o del producto). */
  const priceOfColor = (c: string): number =>
    selected ? (selected.colorPrices[c] ?? 0) : (product.colorPrices[c] ?? 0);

  /** ¿Algún color cuesta distinto? (para explicar el punto dorado). */
  const hasSpecialPrice =
    !isMulti &&
    colorChoices.some((c) => {
      const own = priceOfColor(c);
      return own > 0 && own !== beforeColor;
    });

  const hasColorPrice = !isMulti && color != null && unitPrice !== beforeColor;

  // En multicolor con combinación el label ya lleva los colores → no se repiten
  // en la línea. Multicolor fijo: todos los colores. Color único: el elegido.
  const lineColor = isMulti
    ? isCombo
      ? null
      : product.colors.length > 0
        ? product.colors.join(" + ")
        : null
    : color;

  function buildItem() {
    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice,
      image: product.image,
      variantId: selected?.id ?? null,
      variantLabel: selected?.label ?? null,
      color: lineColor,
    };
  }

  return {
    product,
    isMulti,
    variantId,
    setVariantId,
    color,
    setColor,
    qty,
    setQty,
    selected,
    unitPrice,
    beforeColor,
    basePrice,
    isCombo,
    variantsAreCombos,
    colorChoices,
    priceOfColor,
    hasSpecialPrice,
    hasColorPrice,
    lineColor,
    buildItem,
  };
}
