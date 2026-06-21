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
      >
        <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z" />
      </svg>
      {mounted && count > 0 ? <span className="ic-badge">{count}</span> : null}
    </button>
  );
}
