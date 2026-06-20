import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type PriceTagProps = {
  price: number;
  salePrice?: number | null;
  isOnSale?: boolean;
  from?: boolean; // muestra "desde" cuando hay variantes de tamaño
  className?: string;
};

export function PriceTag({
  price,
  salePrice,
  isOnSale = false,
  from = false,
  className,
}: PriceTagProps) {
  const effective = isOnSale && salePrice != null ? salePrice : price;
  return (
    <div className={cn("prod-price", className)}>
      {from ? <span className="from">desde</span> : null}
      <span className={cn("now", isOnSale && "gold")}>
        {formatPrice(effective)}
      </span>
      {isOnSale && salePrice != null ? (
        <span className="old">{formatPrice(price)}</span>
      ) : null}
    </div>
  );
}
