"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { colorUnitPrice } from "@/features/products/pricing";
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

export type AddToCartProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  salePrice: number | null;
  isOnSale: boolean;
  image: string | null;
  variants: Variant[];
  colorMode: "single" | "multi";
  colors: string[];
  colorPrices: Record<string, number>;
};

export function AddToCart({ product }: { product: AddToCartProduct }) {
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
  const openCart = useUiStore((s) => s.openCart);
  const router = useRouter();

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const basePrice =
    product.isOnSale && product.salePrice != null
      ? product.salePrice
      : product.price;
  // Precio por color (solo "color único"): el color elegido con precio propio
  // fija el precio EXACTO. Misma función pura que usa el servidor al cobrar.
  const unitPrice = colorUnitPrice(
    Math.max(0, selected?.price ?? basePrice),
    product.colorMode,
    product.colorPrices,
    color,
  );
  // En multicolor la pieza lleva la combinación fija; en color único, el elegido.
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
    openCart();
  }
  // "Comprar ahora": agrega y va directo al checkout.
  function handleBuyNow() {
    addItem(buildItem(), qty);
    router.push("/checkout");
  }

  return (
    <div className="space-y-4">
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
                  {!isMulti && (product.colorPrices[c] ?? 0) > 0
                    ? ` · ${formatPrice(product.colorPrices[c]!)}`
                    : ""}
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
  );
}
