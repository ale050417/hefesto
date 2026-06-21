"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";
import { toast } from "@/stores/toastStore";
import type { ProductView } from "@/features/products/types";
import {
  clearMyWishlistAction,
  getMyWishlistProductsAction,
  toggleWishlistAction,
} from "../actions";
import { useWishlistStore } from "../store";

export function FavDrawer() {
  const open = useUiStore((s) => s.favOpen);
  const close = useUiStore((s) => s.closeFav);
  const ids = useWishlistStore((s) => s.ids);
  const setInWishlist = useWishlistStore((s) => s.setInWishlist);
  const setIds = useWishlistStore((s) => s.setIds);
  const addItem = useCartStore((s) => s.addItem);
  const mounted = useMounted();

  const [items, setItems] = useState<ProductView[]>([]);

  // Recarga la lista al abrir o cuando cambian los ids (agregar/quitar).
  // setState va en el .then (continuación async), no en el cuerpo del efecto.
  useEffect(() => {
    if (!open) return;
    let active = true;
    getMyWishlistProductsAction().then((data) => {
      if (active) setItems(data);
    });
    return () => {
      active = false;
    };
  }, [open, ids]);

  if (!mounted) return null;

  const addToCart = (p: ProductView) => {
    addItem({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      unitPrice: p.effectivePrice,
      image: p.primaryImage?.url ?? null,
      variantId: null,
      variantLabel: null,
    });
    toast(`${p.name} agregado al carrito`, "success");
  };

  const remove = async (p: ProductView) => {
    setInWishlist(p.id, false);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    await toggleWishlistAction(p.id);
  };

  const addAll = () => {
    items.forEach((p) =>
      addItem({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        unitPrice: p.effectivePrice,
        image: p.primaryImage?.url ?? null,
        variantId: null,
        variantLabel: null,
      }),
    );
    toast("Favoritos agregados al carrito", "success");
  };

  const clearAll = async () => {
    setItems([]);
    setIds([]);
    await clearMyWishlistAction();
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[300] bg-black/50"
          onClick={close}
          aria-hidden
        />
      ) : null}
      <aside
        className={cn(
          "border-surface-2 bg-surface-1 fixed top-0 right-0 z-[300] flex h-dvh w-full max-w-sm flex-col border-l shadow-lg transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="border-surface-2 flex items-center justify-between border-b p-4">
          <h2 className="font-display text-fg flex items-center gap-2 text-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="18"
              height="18"
              className="text-[var(--gold-bright)]"
            >
              <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z" />
            </svg>
            Favoritos
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-dim hover:text-fg"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              width="44"
              height="44"
              className="text-faint"
            >
              <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1z" />
            </svg>
            <div>
              <p className="text-fg font-medium">No tenés favoritos todavía</p>
              <p className="text-dim mt-1 text-sm">
                Tocá el ♥ en cualquier producto para guardarlo acá.
              </p>
            </div>
            <Link
              href="/catalogo"
              onClick={close}
              className={buttonVariants({ size: "sm" })}
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((p) => (
                <div
                  key={p.id}
                  className="border-surface-2 flex gap-3 rounded-lg border p-2"
                >
                  <Link
                    href={`/producto/${p.slug}`}
                    onClick={close}
                    className="bg-surface-2 relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md"
                  >
                    {p.primaryImage ? (
                      <Image
                        src={p.primaryImage.url}
                        alt={p.primaryImage.alt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/producto/${p.slug}`}
                      onClick={close}
                      className="text-fg truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-sm font-semibold text-[var(--gold-bright)]">
                      {p.hasVariants ? "Desde " : ""}
                      {formatPrice(p.effectivePrice)}
                    </span>
                    <div className="mt-auto flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className="text-xs font-semibold text-[var(--gold-bright)] hover:underline"
                      >
                        Agregar
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="text-dim hover:text-danger text-xs"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-surface-2 space-y-2 border-t p-4">
              <button
                type="button"
                onClick={addAll}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                Agregar todo al carrito
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-dim hover:text-danger w-full text-center text-xs"
              >
                Vaciar favoritos
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
