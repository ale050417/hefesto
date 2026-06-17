"use client";

import { selectItemCount, useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";

export function CartButton() {
  const count = useCartStore(selectItemCount);
  const openCart = useUiStore((s) => s.openCart);
  const mounted = useMounted();

  return (
    <button
      type="button"
      onClick={openCart}
      className="text-dim hover:text-fg relative text-sm transition-colors"
      aria-label="Abrir carrito"
    >
      Carrito
      {mounted && count > 0 ? (
        <span className="bg-primary text-primary-fg ml-1 rounded-full px-1.5 py-0.5 text-xs">
          {count}
        </span>
      ) : null}
    </button>
  );
}
