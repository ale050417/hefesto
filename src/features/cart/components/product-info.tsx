"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { colorUnitPrice } from "@/features/products/pricing";
import { useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";

type Variant = {
  id: string;
  label: string;
  price: number | null;
  /** Matriz tamaño × color: precio del color DENTRO de este tamaño. */
  colorPrices: Record<string, number>;
};

export type ProductInfoData = {
  id: string;
  slug: string;
  name: string;
  categoryName: string | null;
  description: string | null;
  price: number;
  salePrice: number | null;
  isOnSale: boolean;
  discountPercent: number | null;
  isNew: boolean;
  image: string | null;
  variants: Variant[];
  colorMode: "single" | "multi";
  colors: string[];
  colorPrices: Record<string, number>;
  /** Nombre del color → su hex REAL del catálogo (Filamentos), no un genérico. */
  colorHex: Record<string, string>;
  specs: { label: string; value: string }[];
};

/**
 * ¿El tilde va en blanco o en negro sobre este color? Se decide por la
 * luminancia percibida (el ojo ve el verde mucho más claro que el azul, de ahí
 * los pesos). Sin esto, el tilde blanco desaparecía sobre un swatch amarillo.
 */
function readableOn(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.replace(/./g, (ch) => ch + ch) : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#ffffff";
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

/**
 * Columna derecha de la página de producto (cliente): precio DINÁMICO que
 * cambia con la variante/color + selectores + "Comprar ahora" y "Agregar al
 * carrito". Reemplaza al viejo PriceTag + AddToCart para que el precio grande
 * refleje siempre lo elegido.
 */
export function ProductInfo({
  product,
  onColorChange,
  onVariantChange,
}: {
  product: ProductInfoData;
  /** Avisa el color elegido (para que la galería salte a su foto). */
  onColorChange?: (color: string | null) => void;
  /** Avisa la variante elegida (combinación multicolor → su foto). */
  onVariantChange?: (label: string | null) => void;
}) {
  const router = useRouter();
  const hasVariants = product.variants.length > 0;
  const hasColors = product.colors.length > 0;
  const isMulti = product.colorMode === "multi";

  const [variantId, setVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [color, setColorState] = useState<string | null>(
    !isMulti ? (product.colors[0] ?? null) : null,
  );
  const setColor = (c: string | null) => {
    setColorState(c);
    onColorChange?.(c);
  };
  const [qty, setQty] = useState(1);

  const addItem = useCartStore((s) => s.addItem);
  const flashCart = useUiStore((s) => s.flashCart);

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  // ¿Las variantes son combinaciones de colores o tamaños? Define el título
  // del selector (un multicolor puede tener TAMAÑOS: "15 cm", no combos).
  const variantsAreCombos =
    isMulti && product.variants.some((v) => v.label.includes(" + "));
  const basePrice =
    product.isOnSale && product.salePrice != null
      ? product.salePrice
      : product.price;
  // Precio base según variante/tamaño o precio (oferta) del producto.
  const beforeColor = Math.max(0, selected?.price ?? basePrice);
  // Precio por color (solo "color único"), ESPEJO exacto del servidor:
  // - Con tamaño elegido manda la MATRIZ tamaño × color (el 10 cm morado puede
  //   costar más que el 10 cm azul); sin celda queda el precio del tamaño.
  // - Sin tamaños, el precio por color del producto (colorUnitPrice, la misma
  //   función pura que usa el cobro) → nunca divergen.
  const matrixPrice =
    !isMulti && selected && color ? selected.colorPrices[color] : undefined;
  const unitPrice = selected
    ? matrixPrice != null && matrixPrice > 0
      ? matrixPrice
      : beforeColor
    : colorUnitPrice(
        beforeColor,
        product.colorMode,
        product.colorPrices,
        color,
      );
  const hasColorPrice = !isMulti && color != null && unitPrice !== beforeColor;
  // ¿Mostrar el precio original tachado? Solo si es oferta y el precio no lo
  // reemplaza ni el tamaño ni el color.
  const showStrike =
    product.isOnSale &&
    product.salePrice != null &&
    !selected?.price &&
    !hasColorPrice;
  // ¿La variante elegida es una COMBINACIÓN de colores ("Negro + Rojo") o un
  // TAMAÑO ("15 cm")? En multicolor conviven los dos casos y se tratan distinto.
  const isCombo = isMulti && selected != null && selected.label.includes(" + ");
  // Multicolor con COMBINACIONES: el label ya lleva los colores → color null
  // para no duplicar. Multicolor con tamaños o fijo: todos los colores de la
  // pieza. Color único: el elegido.
  // Colores que se ofrecen: en un combo multicolor, los del combo elegido; si
  // no, los del producto.
  const colorChoices =
    isCombo && selected
      ? selected.label.split(" + ").map((x) => x.trim())
      : product.colors;
  // ¿Algún color cuesta distinto? (para explicar el punto dorado).
  const hasSpecialPrice =
    !isMulti &&
    colorChoices.some((c) => {
      const own = selected
        ? (selected.colorPrices[c] ?? 0)
        : (product.colorPrices[c] ?? 0);
      return own > 0 && own !== beforeColor;
    });
  const lineColor = isMulti
    ? isCombo
      ? null
      : hasColors
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
  function handleAdd() {
    addItem(buildItem(), qty);
    flashCart();
  }
  function handleBuyNow() {
    addItem(buildItem(), qty);
    router.push("/checkout");
  }

  return (
    <div>
      {product.categoryName ? (
        <p className="text-faint text-sm">{product.categoryName}</p>
      ) : null}
      <h1 className="font-display text-fg mt-1 text-3xl">{product.name}</h1>

      {product.isOnSale || product.isNew ? (
        <div className="mt-3 flex items-center gap-2">
          {product.isOnSale && product.discountPercent ? (
            <Badge variant="danger">-{product.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
        </div>
      ) : null}

      {/* Precio dinámico: cambia con la variante/color elegido. */}
      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-fg text-3xl sm:text-4xl">
          {formatPrice(unitPrice)}
        </span>
        {showStrike ? (
          <span className="text-faint text-lg line-through">
            {formatPrice(product.price)}
          </span>
        ) : null}
      </div>

      {product.description ? (
        <p className="text-dim mt-4">{product.description}</p>
      ) : null}

      <div className="mt-6 space-y-4">
        {hasVariants ? (
          <div>
            <p className="text-fg mb-2 text-sm font-medium">
              {variantsAreCombos ? "Combinación" : "Tamaño"}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Solo el label: el precio grande de arriba ya refleja lo
                  elegido (pedido de Ale: sin "$" en los botones de tamaño). */}
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVariantId(v.id);
                    // Combinación multicolor: la galería salta a su foto.
                    onVariantChange?.(v.label);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
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
          /* MULTICOLOR: la pieza lleva TODOS estos colores, no se elige uno.
             Van agrupados dentro de un recuadro para que se lea como un
             conjunto y no como botones para tocar (pedido de Ale 2026-08-03). */
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
              {/* El nombre del elegido va ACÁ, fijo. Es la condición que hace
                  que los círculos funcionen: el cliente nunca tiene que
                  adivinar cuál es "verde kriptonita" (2026-08-03). */}
              {color ? (
                <span className="text-primary ml-1.5 font-semibold">
                  {color}
                </span>
              ) : null}
            </p>
            {/* Muestrario de color (patrón de Nike / Zara / Apple): SIEMPRE
                círculos, sin importar cuántos haya. Un solo patrón se aprende
                una vez; mezclar chips con texto y círculos obligaba a releer
                la pantalla en cada producto. */}
            <div className="flex flex-wrap gap-2.5">
              {colorChoices.map((c) => {
                const active = color === c;
                const hex = product.colorHex[c] ?? "#888";
                // Precio del color: con tamaño elegido, la celda de SU matriz;
                // sin tamaños, el precio por color del producto. Solo se
                // ANUNCIA si es DISTINTO del precio del resto: repetir el mismo
                // número en cada uno era ruido puro.
                const own = selected
                  ? (selected.colorPrices[c] ?? 0)
                  : (product.colorPrices[c] ?? 0);
                const showPrice = own > 0 && own !== beforeColor;
                return (
                  <button
                    key={c}
                    type="button"
                    title={showPrice ? `${c} · ${formatPrice(own)}` : c}
                    aria-label={showPrice ? `${c}, ${formatPrice(own)}` : c}
                    aria-pressed={active}
                    onClick={() => setColor(c)}
                    className={cn(
                      // 44px de área táctil en celular: un círculo chico en el
                      // teléfono es el error clásico de este patrón.
                      "relative grid h-11 w-11 place-items-center rounded-full transition-transform sm:h-10 sm:w-10",
                      active && "scale-105",
                    )}
                    style={{
                      outline: active
                        ? "2px solid var(--gold-bright)"
                        : "1px solid var(--border)",
                      outlineOffset: active ? 2 : -1,
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: hex,
                        // Aro tenue: un color casi blanco necesita un límite
                        // para no perderse contra el fondo.
                        border: "1px solid rgba(128,128,128,.35)",
                        display: "inline-block",
                      }}
                    />
                    {/* Tilde adentro del elegido, en blanco o negro según el
                        color. El borde solo no alcanza: ~8% de los hombres
                        tiene algún grado de daltonismo, y sobre un círculo
                        blanco el aro dorado casi no se ve. */}
                    {active ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke={readableOn(hex)}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : null}
                    {/* Punto dorado: este color cuesta distinto. */}
                    {showPrice ? (
                      <span
                        aria-hidden
                        className="bg-primary absolute top-0 right-0 h-2.5 w-2.5 rounded-full"
                        style={{ border: "1.5px solid var(--surface-1)" }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
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

        {/* Comprar ahora (directo al checkout) + agregar al carrito. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            onClick={handleBuyNow}
            className="flex-1"
          >
            Comprar ahora · {formatPrice(unitPrice * qty)}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={handleAdd}
            className="flex-1"
          >
            Agregar al carrito
          </Button>
        </div>
      </div>

      {product.specs.length > 0 ? (
        <dl className="border-surface-2 mt-8 border-t text-sm">
          {product.specs.map((s) => (
            <div
              key={s.label}
              className="border-surface-2 flex justify-between border-b py-2"
            >
              <dt className="text-dim">{s.label}</dt>
              <dd className="text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="border-surface-2 bg-surface-1 text-dim mt-6 rounded-md border p-3 text-xs">
        El costo de envío corre por cuenta del cliente. Coordinamos el envío y
        registramos el código de seguimiento.
      </p>
    </div>
  );
}
