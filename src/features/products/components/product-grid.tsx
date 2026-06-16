import { EmptyState } from "@/components/shared/empty-state";
import type { ProductView } from "../types";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: ProductView[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No hay productos para mostrar"
        description="Probá quitar algún filtro o volvé más tarde."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
