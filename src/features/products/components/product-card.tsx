import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
          />
        ) : null}
        <div className="prod-badges">
          {product.isOnSale && product.discountPercent ? (
            <Badge variant="danger">-{product.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge variant="info">Nuevo</Badge> : null}
        </div>
      </div>
      <div className="prod-body">
        {product.category ? (
          <span className="prod-cat">{product.category.name}</span>
        ) : null}
        <h3 className="prod-name line-clamp-1">{product.name}</h3>
        <PriceTag
          price={product.price}
          salePrice={product.salePrice}
          isOnSale={product.isOnSale}
          from={product.hasVariants}
        />
      </div>
    </Link>
  );
}
