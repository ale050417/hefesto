import { EmptyState } from "@/components/shared/empty-state";
import { getBrandSettings } from "@/features/settings/service";
import type { ProductView } from "../types";
import { ProductCard } from "./product-card";

/**
 * Único punto de entrada de la grilla de tarjetas (home, catálogo, favoritos,
 * relacionados): resuelve acá el modo de negocio UNA sola vez y lo baja a
 * cada tarjeta, en vez de que cada una lo pida por separado.
 */
export async function ProductGrid({ products }: { products: ProductView[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="No hay productos para mostrar"
        description="Probá quitar algún filtro o volvé más tarde."
      />
    );
  }
  const brand = await getBrandSettings();
  const isVidriera = brand.businessMode === "vidriera";
  return (
    <div className="grid-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isVidriera={isVidriera}
          whatsappPhone={brand.whatsapp}
        />
      ))}
    </div>
  );
}
