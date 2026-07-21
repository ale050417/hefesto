"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";

type Variant = { id: string; label: string; price: number | null };

const FILAMENT_HEX: Record<string, string> = {
  Negro: "#1a1a1f",
  Blanco: "#f4f4f0",
  Dorado: "#C9A84C",
  Gris: "#8b8b95",
  Rojo: "#d14b3c",
  Azul: "#3a72c4",
  Verde: "#3fa46a",
  Galaxia: "#4b3a78",
  Translúcido: "#cfe6ee",
  Arcoíris: "#d98a5a",
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
  specs: { label: string; value: string }[];
};

/**
 * Columna derecha de la página de producto (cliente): precio DINÁMICO que
 * cambia con la variante/color + selectores + "Comprar ahora" y "Agregar al
 * carrito". Reemplaza al viejo PriceTag + AddToCart para que el precio grande
 * refleje siempre lo elegido.
 */
export function ProductInfo({ product }: { product: ProductInfoData }) {
  const router = useRouter();
  const hasVariants = product.variants.length > 0;
  const hasColors = product.colors.length > 0;
  const isMulti = product.colorMode === "multi";

  const [variantId, setVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [color, setColor] = useState<string | null>(
    !isMulti ? (product.colors[0] ?? null) : null,
  );
  const [qty, setQty] = useState(1);

  const addItem = useCartStore((s) => s.addItem);
  const flashCart = useUiStore((s) => s.flashCart);

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const basePrice =
    product.isOnSale && product.salePrice != null
      ? product.salePrice
      : product.price;
  // El color NO cambia el precio: el producto tiene un precio único. El precio
  // sale de la variante/tamaño elegido o del precio base.
  const unitPrice = Math.max(0, selected?.price ?? basePrice);
  // ¿Mostrar el precio original tachado? Solo si es oferta y no hay precio propio
  // de tamaño.
  const showStrike =
    product.isOnSale && product.salePrice != null && !selected?.price;
  const lineColor = isMulti
    ? hasColors
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
        <span className="font-display text-fg text-4xl">
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
            <p className="text-fg mb-2 text-sm font-medium">Tamaño</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    v.id === variantId
                      ? "border-primary text-primary"
                      : "border-surface-3 text-fg hover:border-primary",
                  )}
                >
                  {v.label}
                  {v.price != null ? ` · ${formatPrice(v.price)}` : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {hasColors ? (
          <div>
            <p className="text-fg mb-2 text-sm font-medium">
              {isMulti ? "Colores de la pieza" : "Color"}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const active = !isMulti && color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={isMulti}
                    onClick={() => !isMulti && setColor(c)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                      active
                        ? "border-primary text-primary"
                        : "border-surface-3 text-fg",
                      !isMulti && "hover:border-primary",
                      isMulti && "cursor-default",
                    )}
                  >
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        background: FILAMENT_HEX[c] ?? "#888",
                        border: "1px solid rgba(255,255,255,.25)",
                        display: "inline-block",
                      }}
                    />
                    {c}
                  </button>
                );
              })}
            </div>
            {isMulti ? (
              <p className="text-faint mt-1 text-xs">
                Esta pieza se imprime con todos estos colores.
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
              className="border-surface-3 text-fg h-9 w-9 rounded-md border"
              aria-label="Restar"
            >
              −
            </button>
            <span className="text-fg w-6 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="border-surface-3 text-fg h-9 w-9 rounded-md border"
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
