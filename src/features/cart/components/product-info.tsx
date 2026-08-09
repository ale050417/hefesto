"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { buildWhatsappUrl, siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useProductChoice } from "../useProductChoice";
import { useCartActions } from "../useCartActions";
import { useInquiryActions } from "../useInquiryActions";
import { ChoiceControls } from "./choice-controls";
import type { ChooserProduct } from "../types";

export type ProductInfoData = ChooserProduct & {
  categoryName: string | null;
  description: string | null;
  discountPercent: number | null;
  isNew: boolean;
  specs: { label: string; value: string }[];
};

/**
 * Columna derecha de la página de producto: precio DINÁMICO que cambia con el
 * tamaño/color + selectores + "Comprar ahora" y "Agregar al carrito".
 *
 * Los selectores y el cálculo del precio son los MISMOS que usa el modal rápido
 * del catálogo (ChoiceControls + useProductChoice): dos pantallas que muestran
 * el precio de lo mismo no pueden calcularlo cada una por su lado.
 */
export function ProductInfo({
  product,
  onColorChange,
  onVariantChange,
  isVidriera = false,
  whatsappPhone = null,
}: {
  product: ProductInfoData;
  /** Avisa el color elegido (para que la galería salte a su foto). */
  onColorChange?: (color: string | null) => void;
  /** Avisa la variante elegida (combinación multicolor → su foto). */
  onVariantChange?: (label: string | null) => void;
  /** Vidriera digital: "Consultar por WhatsApp" en vez de comprar online. */
  isVidriera?: boolean;
  whatsappPhone?: string | null;
}) {
  const choice = useProductChoice(product);
  const { unitPrice, qty, hasColorPrice, selected, color, buildItem } = choice;
  const { agregar, comprarAhora } = useCartActions();
  const { agregar: agregarConsulta } = useInquiryActions();

  // ¿Mostrar el precio original tachado? Solo si es oferta y el precio no lo
  // reemplaza ni el tamaño ni el color.
  const showStrike =
    product.isOnSale &&
    product.salePrice != null &&
    !selected?.price &&
    !hasColorPrice;

  return (
    <div>
      {product.categoryName ? (
        <p className="text-faint text-sm">{product.categoryName}</p>
      ) : null}
      <h1 className="font-display text-fg mt-1 text-3xl">{product.name}</h1>

      {product.isOnSale || product.isNew ? (
        <div className="mt-3 flex items-center gap-2">
          {product.isOnSale && product.discountPercent ? (
            <Badge variant="danger">-{product.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
        </div>
      ) : null}

      {/* Precio dinámico: cambia con la variante/color elegido. */}
      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-display text-fg text-3xl sm:text-4xl">
          {formatPrice(unitPrice)}
        </span>
        {showStrike ? (
          <span className="text-faint text-lg line-through">
            {formatPrice(product.price)}
          </span>
        ) : null}
      </div>

      {product.description ? (
        <p className="text-dim mt-4">{product.description}</p>
      ) : null}

      <div className="mt-6 space-y-4">
        <ChoiceControls
          choice={choice}
          onColorChange={onColorChange}
          onVariantChange={onVariantChange}
        />

        {/* Vidriera digital: consulta por WhatsApp con la elección hecha
            (tamaño/color/cantidad ya van en el mensaje), o sumarlo a la lista
            de consulta para preguntar por varios juntos. Sin carrito. */}
        {isVidriera ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={buildWhatsappUrl(
                whatsappPhone,
                `¡Hola! Quería consultar por "${product.name}"` +
                  (selected ? ` (${selected.label})` : "") +
                  (color ? ` color ${color}` : "") +
                  (qty > 1 ? ` x${qty}` : "") +
                  ` — ${formatPrice(unitPrice * qty)}.\n${siteUrl}/producto/${product.slug}`,
              )}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                buttonVariants({ size: "lg" }),
                "flex-1 text-center",
              )}
            >
              Consultar ya
            </a>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={() => agregarConsulta(buildItem(), qty)}
            >
              Agregar a la lista
            </Button>
          </div>
        ) : (
          /* Comprar ahora (directo al checkout) + agregar al carrito. */
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              onClick={() => comprarAhora(buildItem(), qty)}
              className="flex-1"
            >
              Comprar ahora · {formatPrice(unitPrice * qty)}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => agregar(buildItem(), qty)}
              className="flex-1"
            >
              Agregar al carrito
            </Button>
          </div>
        )}
      </div>

      {product.specs.length > 0 ? (
        <dl className="border-surface-2 mt-8 border-t text-sm">
          {product.specs.map((s) => (
            <div
              key={s.label}
              className="border-surface-2 flex justify-between border-b py-2"
            >
              <dt className="text-dim">{s.label}</dt>
              <dd className="text-fg">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="border-surface-2 bg-surface-1 text-dim mt-6 rounded-md border p-3 text-xs">
        El costo de envío corre por cuenta del cliente. Coordinamos el envío y
        registramos el código de seguimiento.
      </p>
    </div>
  );
}
