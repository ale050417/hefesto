import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/features/wishlist/components/wishlist-button";
import { PriceTag } from "@/components/shared/price-tag";
import type { ProductView } from "../types";

export function ProductCard({ product }: { product: ProductView }) {
  return (
    <Link href={`/producto/${product.slug}`} className="prod-card">
      <div className="prod-media">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            alt={product.primaryImage.alt}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
            style={{
              objectPosition: product.primaryImage.position,
              // Nunca por debajo de 1: el zoom del encuadre solo acerca, así la
              // foto SIEMPRE llena la tarjeta (antes un scale<1 dejaba huecos).
              transform: `scale(${Math.max(1, product.primaryImage.scale)})`,
            }}
          />
        ) : (
          /* Sin foto: un ícono tenue en vez de un rectángulo vacío. */
          <span className="text-faint absolute inset-0 grid place-items-center">
            <svg
              viewBox="0 0 24 24"
              width="34"
              height="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-50"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </span>
        )}
        <div className="prod-badges">
          {/* El % solo si la oferta de verdad es lo que se paga (con tamaños
              con precio propio el sale_price no se aplica). */}
          {product.saleApplies && product.discountPercent ? (
            <Badge variant="danger">-{product.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
        </div>
        <WishlistButton productId={product.id} />
      </div>
      <div className="prod-body">
        {product.category ? (
          <span className="prod-cat">{product.category.name}</span>
        ) : null}
        <h3 className="prod-name line-clamp-2 min-h-[2.6em]">{product.name}</h3>
        <PriceTag
          price={product.displayPrice}
          compareAt={product.saleApplies ? product.price : null}
          from={product.priceFrom}
        />
      </div>
    </Link>
  );
}
