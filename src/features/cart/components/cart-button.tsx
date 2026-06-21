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
      className="icon-btn"
      aria-label={`Abrir carrito${mounted && count > 0 ? ` (${count})` : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="17"
        height="17"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {mounted && count > 0 ? <span className="ic-badge">{count}</span> : null}
    </button>
  );
}
