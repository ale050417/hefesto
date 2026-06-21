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
      >
        <circle cx="9" cy="21" r="1.6" />
        <circle cx="18" cy="21" r="1.6" />
        <path d="M2.5 3h2l2.2 12.4a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.6L21.5 7H6" />
      </svg>
      {mounted && count > 0 ? <span className="ic-badge">{count}</span> : null}
    </button>
  );
}
