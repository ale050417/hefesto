import { apiError, apiOk, PUBLIC_CACHE, withApi } from "@/core/api/respond";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/features/products/services/catalogService";

/**
 * GET /api/v1/products/:slug — detalle de un producto publicado + relacionados
 * (app móvil, 2026-10-31). 404 si no existe o no está publicado.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "products/slug",
  async (_request: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const product = await getProductBySlug(slug);
    if (!product) return apiError("not_found", "No encontramos ese producto.");
    const related = await getRelatedProducts(slug, 4);
    return apiOk({ product, related }, PUBLIC_CACHE);
  },
);
