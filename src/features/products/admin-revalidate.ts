import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Invalidación de caché de las escrituras que llegan por la API de la app
 * (2026-10-31). Hace lo mismo que las Server Actions de `actions.ts`, con una
 * diferencia obligada: `updateTag` solo existe dentro de una Server Action; en
 * una ruta de la API se usa `revalidateTag(tag, "max")` (la tienda sirve la
 * versión vieja una vez y se actualiza sola en la siguiente visita).
 */

/** Listado del panel web + (si se conoce) la ficha pública del producto. */
export function revalidateProductCaches(slug?: string | null): void {
  revalidatePath("/admin/productos");
  if (slug) revalidatePath(`/producto/${slug}`);
}

/** Foto principal: la ficha de edición del panel y el listado. */
export function revalidateProductImages(
  productId: string,
  slug?: string | null,
): void {
  revalidatePath(`/admin/productos/${productId}/editar`);
  revalidateProductCaches(slug);
}

/** Categorías: panel web + tag que usan el footer, la home y el catálogo. */
export function revalidateCategoryCaches(): void {
  revalidatePath("/admin/categorias");
  revalidateTag("categories", "max");
}
