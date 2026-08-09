"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { buildWhatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { selectInquirySubtotal, useInquiryStore } from "@/stores/inquiryStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";
import { buildInquiryMessage } from "../inquiryMessage";
import { InquiryItem } from "./inquiry-item";

/**
 * El "carrito" de la vidriera digital: en vez de ir a pagar, el botón final
 * arma UN mensaje de WhatsApp con toda la lista — el "PDF online" que pidió
 * Ale (2026-08-09). No hay cupón ni checkout acá: es una consulta, no una
 * compra.
 */
export function InquiryDrawer({
  whatsappPhone = null,
}: {
  whatsappPhone?: string | null;
}) {
  const open = useUiStore((s) => s.inquiryOpen);
  const close = useUiStore((s) => s.closeInquiry);
  const items = useInquiryStore((s) => s.items);
  const subtotal = useInquiryStore(selectInquirySubtotal);
  const clear = useInquiryStore((s) => s.clear);
  const mounted = useMounted();
  if (!mounted) return null;

  const waHref = buildWhatsappUrl(whatsappPhone, buildInquiryMessage(items));

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
          <h2 className="font-display text-fg text-lg">Tu lista de consulta</h2>
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
            <p className="text-dim">Todavía no agregaste nada.</p>
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
                <InquiryItem
                  key={`${item.productId}-${item.variantId ?? "base"}-${item.color ?? "base"}`}
                  item={item}
                />
              ))}
            </div>
            <div className="border-surface-2 space-y-3 border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-dim text-sm">Total aprox.</span>
                <span className="text-fg text-lg font-semibold">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer noopener"
                onClick={close}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                Enviar consulta por WhatsApp
              </a>
              <button
                type="button"
                onClick={clear}
                className="text-faint hover:text-fg block w-full text-center text-xs"
              >
                Vaciar lista
              </button>
              <p className="text-faint text-center text-xs">
                El precio final se confirma por WhatsApp.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
