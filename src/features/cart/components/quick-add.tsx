"use client";

import { useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { buildWhatsappUrl, siteUrl } from "@/lib/site";
import { getProductOptionsAction } from "../actions";
import { useCartActions } from "../useCartActions";
import { ProductOptionsModal } from "./product-options-modal";
import type { ChooserProduct } from "../types";

/** El "+" de agregar (al carrito real, o a la lista de consulta en vidriera). */
function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  );
}

/** Lo que la tarjeta del catálogo sabe del producto. */
export type QuickAddProduct = {
  id: string;
  slug: string;
  name: string;
  displayPrice: number;
  /** El cliente TIENE que elegir tamaño o color antes de comprar. */
  needsChoice: boolean;
  /** Tiene tamaños entre los que elegir (no cuenta el color). */
  hasVariants: boolean;
  /** Combinación fija de colores (multicolor); null si no aplica. */
  lineColor: string | null;
  image: string | null;
};

/**
 * "Agregar al carrito" y "Comprar ahora" desde la tarjeta del catálogo, sin
 * entrar al producto.
 *
 * Si el producto obliga a elegir (tamaños o colores), abre el modal con las
 * opciones. Nunca agrega "a ciegas": sin la elección el servidor rechaza el
 * pedido y, si el color tiene precio propio, el precio mostrado no sería el que
 * se cobra.
 *
 * Las opciones se piden al TOCAR el botón, no al cargar el catálogo.
 */
export function QuickAdd({
  product,
  isVidriera = false,
  whatsappPhone = null,
}: {
  product: QuickAddProduct;
  /** Vidriera digital: "Consultar por WhatsApp" en vez de comprar online. */
  isVidriera?: boolean;
  whatsappPhone?: string | null;
}) {
  const { agregar, comprarAhora } = useCartActions();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<"add" | "buy">("add");
  const [opciones, setOpciones] = useState<ChooserProduct | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yendo, setYendo] = useState(false);
  /** Identifica la carga vigente: descarta respuestas viejas que llegan tarde. */
  const pedido = useRef(0);

  const itemDirecto = () => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    unitPrice: product.displayPrice,
    image: product.image,
    variantId: null,
    variantLabel: null,
    color: product.lineColor,
  });

  async function abrir(modo: "add" | "buy") {
    const mio = ++pedido.current;
    setIntent(modo);
    setOpen(true);
    setOpciones(null);
    setError(null);
    setCargando(true);
    // Se recarga cada vez: los precios y colores pueden haber cambiado en el
    // panel mientras el cliente miraba el catálogo.
    const res = await getProductOptionsAction(product.slug);
    // Si el cliente cerró y volvió a abrir, esta respuesta ya no manda.
    if (mio !== pedido.current) return;
    setCargando(false);
    if (res.ok) setOpciones(res.data);
    else setError(res.error.message);
  }

  if (isVidriera) {
    // Solo el TAMAÑO obliga a elegir antes de consultar (2026-08-09, pedido
    // de Ale): el color no importa acá, se conversa por WhatsApp. Un solo
    // botón siempre — sin "agregar al carrito", consulta de a uno.
    if (product.hasVariants) {
      return (
        <>
          <div className="prod-actions">
            <button
              type="button"
              className="prod-action prod-action-buy"
              onClick={() => void abrir("buy")}
              aria-label={`Consultar ${product.name} por WhatsApp`}
            >
              Consultar ya
            </button>
          </div>
          <ProductOptionsModal
            open={open}
            onClose={() => {
              pedido.current++;
              setOpen(false);
              setCargando(false);
            }}
            product={opciones}
            loading={cargando}
            error={error}
            intent={intent}
            isVidriera
            whatsappPhone={whatsappPhone}
          />
        </>
      );
    }
    const url = `${siteUrl}/producto/${product.slug}`;
    const message =
      `¡Hola! Quería consultar por "${product.name}"` +
      (product.lineColor ? ` (color ${product.lineColor})` : "") +
      ` — ${formatPrice(product.displayPrice)}.\n${url}`;
    return (
      <div className="prod-actions">
        <a
          href={buildWhatsappUrl(whatsappPhone, message)}
          target="_blank"
          rel="noreferrer noopener"
          className="prod-action prod-action-buy"
          aria-label={`Consultar ${product.name} por WhatsApp`}
        >
          Consultar ya
        </a>
      </div>
    );
  }

  function alTocar(modo: "add" | "buy") {
    if (product.needsChoice) {
      void abrir(modo);
      return;
    }
    if (modo === "add") {
      // El aviso lo da `agregar` (uno solo, en toda la tienda).
      agregar(itemDirecto());
      return;
    }
    // El doble toque en celular llegaba al checkout con 2 unidades.
    if (yendo) return;
    setYendo(true);
    comprarAhora(itemDirecto());
  }

  return (
    <>
      <div className="prod-actions">
        <button
          type="button"
          className="prod-action prod-action-buy"
          onClick={() => alTocar("buy")}
          disabled={yendo}
          aria-label={`Comprar ${product.name} ahora`}
        >
          Comprar ahora
        </button>
        <button
          type="button"
          className="prod-action prod-action-add"
          onClick={() => alTocar("add")}
          aria-label={`Agregar ${product.name} al carrito`}
          title="Agregar al carrito"
        >
          <PlusIcon />
        </button>
      </div>

      <ProductOptionsModal
        open={open}
        onClose={() => {
          // Cancela la carga en curso: una respuesta que llegue después no debe
          // pisar el estado del modal siguiente.
          pedido.current++;
          setOpen(false);
          setCargando(false);
        }}
        product={opciones}
        loading={cargando}
        error={error}
        intent={intent}
      />
    </>
  );
}
