"use client";

import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/format";
import { buildWhatsappUrl, siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useProductChoice } from "../useProductChoice";
import { useCartActions } from "../useCartActions";
import { ChoiceControls } from "./choice-controls";
import type { ChooserProduct } from "../types";

/**
 * Modal de opciones del catálogo: elegir tamaño y color sin entrar al producto.
 *
 * El contenido con los selectores está en un componente aparte porque el hook de
 * elección necesita el producto YA cargado (los hooks no pueden ir después de un
 * `if (!data) return`). Mientras carga se muestra el spinner.
 */
export function ProductOptionsModal({
  open,
  onClose,
  product,
  loading,
  error,
  intent,
  isVidriera = false,
  whatsappPhone = null,
}: {
  open: boolean;
  onClose: () => void;
  product: ChooserProduct | null;
  loading: boolean;
  error: string | null;
  /** Con qué botón se abrió: define la acción principal del modal. */
  intent: "add" | "buy";
  /** Vidriera digital: "Consultar" / "Agregar a la lista" en vez de comprar. */
  isVidriera?: boolean;
  whatsappPhone?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? product.name : "Elegí las opciones"}
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : error || !product ? (
        <p className="text-dim py-6 text-center text-sm">
          {error ?? "No pudimos cargar las opciones."}
        </p>
      ) : (
        <OptionsBody
          product={product}
          intent={intent}
          onDone={onClose}
          isVidriera={isVidriera}
          whatsappPhone={whatsappPhone}
        />
      )}
    </Modal>
  );
}

function OptionsBody({
  product,
  intent,
  onDone,
  isVidriera,
  whatsappPhone,
}: {
  product: ChooserProduct;
  intent: "add" | "buy";
  onDone: () => void;
  isVidriera: boolean;
  whatsappPhone: string | null;
}) {
  const choice = useProductChoice(product);
  const { unitPrice, qty, buildItem } = choice;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {product.image ? (
          <span className="border-surface-2 relative h-16 w-16 shrink-0 overflow-hidden rounded-md border">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="font-display text-fg text-xl">
            {formatPrice(unitPrice)}
          </p>
          <Link
            href={`/producto/${product.slug}`}
            className="text-faint text-xs hover:underline"
          >
            Ver todos los detalles
          </Link>
        </div>
      </div>

      <ChoiceControls choice={choice} />

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        {isVidriera ? (
          <ConsultButton
            product={product}
            item={buildItem()}
            qty={qty}
            total={unitPrice * qty}
            whatsappPhone={whatsappPhone}
            onDone={onDone}
          />
        ) : (
          <BuyButtons
            intent={intent}
            item={buildItem()}
            qty={qty}
            total={unitPrice * qty}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}

/** Los dos botones, con el principal según cómo se abrió el modal. */
function BuyButtons({
  intent,
  item,
  qty,
  total,
  onDone,
}: {
  intent: "add" | "buy";
  item: ReturnType<ReturnType<typeof useProductChoice>["buildItem"]>;
  qty: number;
  total: number;
  onDone: () => void;
}) {
  const { agregar, comprarAhora } = useCartActions();
  const add = (
    <Button
      key="add"
      type="button"
      size="lg"
      variant={intent === "buy" ? "secondary" : "primary"}
      className="flex-1"
      onClick={() => {
        agregar(item, qty);
        onDone();
      }}
    >
      Agregar al carrito
    </Button>
  );
  const buy = (
    <Button
      key="buy"
      type="button"
      size="lg"
      variant={intent === "buy" ? "primary" : "secondary"}
      className="flex-1"
      onClick={() => {
        comprarAhora(item, qty);
        onDone();
      }}
    >
      Comprar ahora · {formatPrice(total)}
    </Button>
  );
  return intent === "buy" ? [buy, add] : [add, buy];
}

/** Vidriera: un solo botón, directo a WhatsApp con el tamaño ya elegido. Sin
 *  "agregar a la lista" (Ale, 2026-08-09): consulta de a un producto por vez. */
function ConsultButton({
  product,
  item,
  qty,
  total,
  whatsappPhone,
  onDone,
}: {
  product: ChooserProduct;
  item: ReturnType<ReturnType<typeof useProductChoice>["buildItem"]>;
  qty: number;
  total: number;
  whatsappPhone: string | null;
  onDone: () => void;
}) {
  const message =
    `¡Hola! Quería consultar por "${product.name}"` +
    (item.variantLabel ? ` (${item.variantLabel})` : "") +
    (item.color ? ` color ${item.color}` : "") +
    (qty > 1 ? ` x${qty}` : "") +
    ` — ${formatPrice(total)}.\n${siteUrl}/producto/${product.slug}`;

  return (
    <a
      href={buildWhatsappUrl(whatsappPhone, message)}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onDone}
      className={cn(buttonVariants({ size: "lg" }), "flex-1 text-center")}
    >
      Consultar ya
    </a>
  );
}
