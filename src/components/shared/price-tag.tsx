import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type PriceTagProps = {
  /** Precio que se muestra grande: SIEMPRE uno que el cliente puede pagar. */
  price: number;
  /**
   * Precio anterior para tachar. Solo se dibuja si es mayor al mostrado, así
   * nunca aparece un tachado con el mismo número al lado (pasaba cuando la
   * oferta no llegaba a aplicarse por tener tamaños con precio propio).
   */
  compareAt?: number | null;
  /** Muestra "desde" cuando hay más de un precio posible (tamaños/colores). */
  from?: boolean;
  className?: string;
};

export function PriceTag({
  price,
  compareAt,
  from = false,
  className,
}: PriceTagProps) {
  const showStrike = compareAt != null && compareAt > price;
  return (
    <div className={cn("prod-price", className)}>
      {from ? <span className="from">desde</span> : null}
      <span className={cn("now", showStrike && "gold")}>
        {formatPrice(price)}
      </span>
      {showStrike ? (
        <span className="old">{formatPrice(compareAt)}</span>
      ) : null}
    </div>
  );
}
