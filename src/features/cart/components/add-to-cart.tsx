"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";

type Variant = { id: string; label: string; price: number | null };

export type AddToCartProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  salePrice: number | null;
  isOnSale: boolean;
  image: string | null;
  variants: Variant[];
};

export function AddToCart({ product }: { product: AddToCartProduct }) {
  const hasVariants = product.variants.length > 0;
  const [variantId, setVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUiStore((s) => s.openCart);

  const selected = product.variants.find((v) => v.id === variantId) ?? null;
  const basePrice =
    product.isOnSale && product.salePrice != null
      ? product.salePrice
      : product.price;
  const unitPrice = selected?.price ?? basePrice;

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unitPrice,
        image: product.image,
        variantId: selected?.id ?? null,
        variantLabel: selected?.label ?? null,
      },
      qty,
    );
    openCart();
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

      <div className="flex items-center gap-4">
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
        <Button type="button" size="lg" onClick={handleAdd}>
          Agregar al carrito · {formatPrice(unitPrice * qty)}
        </Button>
      </div>
    </div>
  );
}
