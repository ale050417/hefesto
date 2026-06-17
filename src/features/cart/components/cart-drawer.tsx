"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { selectSubtotal, useCartStore } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";
import { CartItem } from "./cart-item";
import { CouponInput } from "./coupon-input";

export function CartDrawer() {
  const open = useUiStore((s) => s.cartOpen);
  const close = useUiStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore(selectSubtotal);
  const mounted = useMounted();
  if (!mounted) return null;

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
      >
        <div className="border-surface-2 flex items-center justify-between border-b p-4">
          <h2 className="font-display text-fg text-lg">Tu carrito</h2>
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
            <p className="text-dim">Tu carrito está vacío.</p>
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
            <div className="flex-1 overflow-y-auto px-4">
              {items.map((item) => (
                <CartItem
                  key={`${item.productId}-${item.variantId ?? "base"}`}
                  item={item}
                />
              ))}
            </div>
            <div className="border-surface-2 space-y-3 border-t p-4">
              <CouponInput />
              <div className="flex items-center justify-between">
                <span className="text-dim text-sm">Subtotal</span>
                <span className="text-fg text-lg font-semibold">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={close}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                Ir a checkout
              </Link>
              <p className="text-faint text-center text-xs">
                El total final se calcula en el checkout.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
