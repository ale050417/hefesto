import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/shared/price-tag";
import type { ProductView } from "../types";

export function ProductCard({ product }: { product: ProductView }) {
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group border-surface-2 bg-surface-1 block overflow-hidden rounded-lg border transition-shadow hover:shadow-[var(--glow-gold)]"
    >
      <div className="bg-surface-2 relative aspect-square overflow-hidden">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            alt={product.primaryImage.alt}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.isOnSale && product.discountPercent ? (
            <Badge variant="danger">-{product.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
        </div>
      </div>
      <div className="p-4">
        {product.category ? (
          <p className="text-faint text-xs">{product.category.name}</p>
        ) : null}
        <h3 className="text-fg mt-1 line-clamp-1 font-medium">
          {product.name}
        </h3>
        <PriceTag
          className="mt-2"
          price={product.price}
          salePrice={product.salePrice}
          isOnSale={product.isOnSale}
          from={product.hasVariants}
        />
      </div>
    </Link>
  );
}
