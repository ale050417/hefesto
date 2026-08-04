"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { ColorSwatches } from "@/components/shared/color-swatches";
import type { ProductChoice } from "../useProductChoice";

/**
 * Selectores de tamaño, color y cantidad. Los MISMOS en la página del producto
 * y en el modal rápido del catálogo: si el cliente ve una pantalla distinta
 * según de dónde entró, la tienda se siente hecha a pedazos.
 */
export function ChoiceControls({
  choice,
  onColorChange,
  onVariantChange,
}: {
  choice: ProductChoice;
  /** Avisa el color elegido (la galería del producto salta a su foto). */
  onColorChange?: (color: string | null) => void;
  /** Avisa la variante elegida (combinación multicolor → su foto). */
  onVariantChange?: (label: string | null) => void;
}) {
  const {
    product,
    isMulti,
    variantId,
    setVariantId,
    color,
    setColor,
    qty,
    setQty,
    beforeColor,
    variantsAreCombos,
    colorChoices,
    priceOfColor,
    hasSpecialPrice,
  } = choice;

  const hasVariants = product.variants.length > 0;
  const hasColors = product.colors.length > 0;

  const elegirColor = (c: string | null) => {
    setColor(c);
    onColorChange?.(c);
  };

  return (
    <div className="space-y-4">
      {hasVariants ? (
        <div>
          <p className="text-fg mb-2 text-sm font-medium">
            {variantsAreCombos ? "Combinación" : "Tamaño"}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Solo el label: el precio grande ya refleja lo elegido (pedido de
                Ale: sin "$" en los botones de tamaño). */}
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariantId(v.id);
                  onVariantChange?.(v.label);
                }}
                className={cn(
                  "min-h-11 rounded-md border px-3 py-2 text-sm transition-colors sm:min-h-0",
                  v.id === variantId
                    ? "border-primary text-primary"
                    : "border-surface-3 text-fg hover:border-primary",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {hasColors && isMulti ? (
        /* MULTICOLOR: la pieza lleva TODOS estos colores, no se elige uno. Van
           agrupados en un recuadro para que se lean como un conjunto y no como
           botones para tocar (pedido de Ale 2026-08-03). */
        <div className="border-surface-2 bg-surface-1 rounded-lg border p-3.5">
          <p className="text-fg mb-2.5 text-[13px] font-medium">
            Se imprime con estos colores
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {colorChoices.map((c) => (
              <span
                key={c}
                className="text-dim flex items-center gap-1.5 text-[13px]"
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: product.colorHex[c] ?? "#888",
                    border: "1px solid rgba(255,255,255,.25)",
                    display: "inline-block",
                  }}
                />
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {hasColors && !isMulti ? (
        <div>
          <p className="text-fg mb-2.5 text-sm font-medium">
            Color
            {/* El nombre del elegido va ACÁ, fijo: el cliente nunca tiene que
                adivinar cuál es "verde kriptonita" (2026-08-03). */}
            {color ? (
              <span className="text-primary ml-1.5 font-semibold">{color}</span>
            ) : null}
          </p>
          <ColorSwatches
            options={colorChoices.map((c) => {
              // El precio del color solo se ANUNCIA si es DISTINTO del resto:
              // repetir el mismo número en cada círculo era ruido puro.
              const own = priceOfColor(c);
              const distinto = own > 0 && own !== beforeColor;
              return {
                name: c,
                hex: product.colorHex[c] ?? "#888",
                flag: distinto,
                ...(distinto ? { note: formatPrice(own) } : {}),
              };
            })}
            selected={color ? [color] : []}
            onSelect={elegirColor}
          />
          {hasSpecialPrice ? (
            <p className="text-faint mt-2 text-xs">
              Los colores con punto dorado tienen otro precio.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="text-fg text-sm font-medium">Cantidad</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="border-surface-3 text-fg h-11 w-11 rounded-md border sm:h-9 sm:w-9"
            aria-label="Restar"
          >
            −
          </button>
          <span className="text-fg w-6 text-center">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="border-surface-3 text-fg h-11 w-11 rounded-md border sm:h-9 sm:w-9"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
