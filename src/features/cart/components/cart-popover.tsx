"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  selectItemCount,
  selectSubtotal,
  useCartStore,
} from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Popover "Agregado al carrito" que sale del ícono del carrito (arriba a la
 * derecha) al agregar un producto, en vez de abrir el cajón lateral. Muestra los
 * últimos ítems + subtotal y deja ir al checkout o ver el carrito completo.
 * Se autocierra a los 5 s y se cierra al tocar afuera o la X.
 */
export function CartPopover() {
  const flash = useUiStore((s) => s.cartFlash);
  const closeFlash = useUiStore((s) => s.closeFlash);
  const openCart = useUiStore((s) => s.openCart);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const count = useCartStore(selectItemCount);
  const mounted = useMounted();

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => closeFlash(), 5000);
    return () => clearTimeout(t);
  }, [flash, closeFlash]);

  if (!mounted || !flash) return null;

  const recent = items.slice(-3).reverse();

  return (
    <>
      {/* Tocar afuera cierra (popover, no modal: no oscurece la página). */}
      <div className="fixed inset-0 z-[340]" onClick={closeFlash} aria-hidden />
      <div
        role="dialog"
        aria-label="Agregado al carrito"
        className="border-surface-2 bg-surface-1 fixed top-[64px] right-3 z-[350] w-[min(94vw,360px)] rounded-xl border p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ background: "var(--success)", color: "#04120a" }}
          >
            ✓
          </span>
          <b className="text-fg text-sm">Agregado al carrito</b>
          <button
            type="button"
            onClick={closeFlash}
            className="text-dim hover:text-fg ml-auto"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {recent.map((it) => (
            <div
              key={`${it.productId}-${it.variantId ?? "base"}-${it.color ?? ""}`}
              className="flex items-center gap-3"
            >
              <span className="bg-surface-2 relative block h-11 w-11 shrink-0 overflow-hidden rounded-md">
                {it.image ? (
                  <Image
                    src={it.image}
                    alt={it.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-fg block truncate text-[13px] font-medium">
                  {it.name}
                </span>
                <span className="text-faint block text-[11.5px]">
                  {[it.variantLabel, it.color].filter(Boolean).join(" · ") ||
                    "Estándar"}{" "}
                  · x{it.quantity}
                </span>
              </span>
              <span className="text-fg text-[13px] font-semibold">
                {formatPrice(it.unitPrice * it.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-surface-2 mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-dim text-sm">Subtotal ({count})</span>
          <span className="text-fg text-base font-semibold">
            {formatPrice(subtotal)}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Link
            href="/checkout"
            onClick={closeFlash}
            className={cn(buttonVariants({ size: "md" }), "w-full")}
          >
            Ir a checkout
          </Link>
          <button
            type="button"
            onClick={() => {
              closeFlash();
              openCart();
            }}
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "w-full",
            )}
          >
            Ver carrito completo
          </button>
        </div>
      </div>
    </>
  );
}
