"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toggleWishlistAction } from "../actions";
import { useWishlistStore } from "../store";

export function WishlistButton({ productId }: { productId: string }) {
  const router = useRouter();
  const ids = useWishlistStore((s) => s.ids);
  const setInWishlist = useWishlistStore((s) => s.setInWishlist);
  const [busy, setBusy] = useState(false);
  const on = ids.includes(productId);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const res = await toggleWishlistAction(productId);
    setBusy(false);
    if (res.needsAuth) {
      router.push("/ingresar?redirect=/catalogo");
      return;
    }
    setInWishlist(productId, Boolean(res.inWishlist));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={on ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={on}
      className={cn("prod-fav", on && "on")}
    >
      <svg
        viewBox="0 0 24 24"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        width="17"
        height="17"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
