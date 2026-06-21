"use client";

import { useUiStore } from "@/stores/uiStore";
import { useWishlistStore } from "../store";
import { useMounted } from "@/hooks/use-mounted";

export function FavButton() {
  const openFav = useUiStore((s) => s.openFav);
  const count = useWishlistStore((s) => s.ids.length);
  const mounted = useMounted();

  return (
    <button
      type="button"
      onClick={openFav}
      className="icon-btn"
      aria-label={`Favoritos${mounted && count > 0 ? ` (${count})` : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="17"
        height="17"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {mounted && count > 0 ? <span className="ic-badge">{count}</span> : null}
    </button>
  );
}
