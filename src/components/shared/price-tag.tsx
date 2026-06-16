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
    <p className={cn("flex items-baseline gap-2", className)}>
      {from ? <span className="text-dim text-xs">desde</span> : null}
      <span className="text-fg text-lg font-semibold">
        {formatPrice(effective)}
      </span>
      {isOnSale && salePrice != null ? (
        <span className="text-faint text-sm line-through">
          {formatPrice(price)}
        </span>
      ) : null}
    </p>
  );
}
