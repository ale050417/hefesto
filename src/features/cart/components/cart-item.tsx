"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import {
  type CartItem as CartItemType,
  useCartStore,
} from "@/stores/cartStore";

export function CartItem({ item }: { item: CartItemType }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <div className="border-surface-2 flex gap-3 border-b py-3">
      <div className="bg-surface-2 relative h-16 w-16 shrink-0 overflow-hidden rounded">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm">{item.name}</p>
        {item.variantLabel ? (
          <p className="text-faint text-xs">{item.variantLabel}</p>
        ) : null}
        <p className="text-dim mt-1 text-sm">{formatPrice(item.unitPrice)}</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setQuantity(item.productId, item.variantId, item.quantity - 1)
            }
            className="border-surface-3 text-fg h-6 w-6 rounded border"
            aria-label="Restar"
          >
            −
          </button>
          <span className="text-fg w-6 text-center text-sm">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() =>
              setQuantity(item.productId, item.variantId, item.quantity + 1)
            }
            className="border-surface-3 text-fg h-6 w-6 rounded border"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => removeItem(item.productId, item.variantId)}
      >
        Quitar
      </Button>
    </div>
  );
}
