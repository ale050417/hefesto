"use client";

import { useState } from "react";
import {
  ProductGallery,
  type GalleryImage,
} from "@/features/products/components/product-gallery";
import {
  ProductInfo,
  type ProductInfoData,
} from "@/features/cart/components/product-info";

/**
 * Vitrina del producto: conecta la GALERÍA con el selector de COLOR. Al elegir
 * un color, la galería salta a la primera foto etiquetada con ese color (el set
 * verde muestra su foto verde); si el color no tiene foto propia, no se mueve.
 * El click manual en las miniaturas sigue funcionando (galería controlada).
 */
export function ProductShowcase({
  images,
  product,
}: {
  images: GalleryImage[];
  product: ProductInfoData;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Color elegido O combinación elegida (multicolor): la galería salta a la
  // primera foto etiquetada con ese valor; sin foto propia, no se mueve.
  function jumpTo(label: string | null) {
    if (!label) return;
    const i = images.findIndex((img) => img.color === label);
    if (i >= 0) setActiveIndex(i);
  }

  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-2">
      <ProductGallery
        images={images}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />
      <ProductInfo
        product={product}
        onColorChange={jumpTo}
        onVariantChange={jumpTo}
      />
    </div>
  );
}
