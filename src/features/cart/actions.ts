"use server";

import { unstable_cache } from "next/cache";
import { getProductBySlug } from "@/features/products/services/catalogService";
import { listColorCatalog } from "@/features/inventory/queries";
import type { ChooserProduct } from "./types";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/**
 * Catálogo de colores cacheado 5 minutos: este es el botón más tocado de la
 * tienda y los colores casi no cambian. Sin cache, cada click pegaba una query
 * extra contra la base que ya tiró producción una vez por pool agotado.
 */
const coloresCacheados = unstable_cache(listColorCatalog, ["color-catalog"], {
  revalidate: 300,
});

/**
 * Opciones de un producto (tamaños, colores y precios) para el modal rápido del
 * catálogo.
 *
 * Se piden al ABRIR el modal, no al cargar el catálogo: si el listado trajera
 * las variantes y los colores de los 24 productos, cada página del catálogo
 * pesaría de más para algo que el cliente toca en uno solo.
 *
 * Es pública a propósito (la usa la tienda sin sesión) y solo devuelve datos que
 * ya se ven en la página del producto. El precio que se muestra es de
 * referencia: el que se cobra lo recalcula el servidor al crear el pedido.
 */
export async function getProductOptionsAction(
  slug: string,
): Promise<ActionResult<ChooserProduct>> {
  try {
    const [product, colorCatalog] = await Promise.all([
      getProductBySlug(slug),
      coloresCacheados(),
    ]);
    if (!product) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Este producto ya no está disponible.",
        },
      };
    }

    // Hex REAL del catálogo de Filamentos (nunca un gris genérico): es la regla
    // general de los colores en toda la app.
    const colorHex: Record<string, string> = {};
    for (const c of colorCatalog) colorHex[c.name] = c.hex ?? "#888";

    return {
      ok: true,
      data: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        salePrice: product.salePrice,
        isOnSale: product.isOnSale,
        image: product.primaryImage?.url ?? null,
        variants: product.variants,
        colorMode: product.colorMode,
        colors: product.colors,
        colorPrices: product.colorPrices,
        colorHex,
      },
    };
  } catch (e) {
    console.error("[cart] getProductOptionsAction", e);
    return {
      ok: false,
      error: {
        code: "UNEXPECTED",
        message: "No pudimos cargar las opciones. Probá de nuevo.",
      },
    };
  }
}
