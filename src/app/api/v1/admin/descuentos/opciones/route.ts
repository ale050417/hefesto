import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  listCategoriesAdmin,
  listProductsForSale,
} from "@/features/products/services/catalogService";
import { loadOrThrow } from "@/lib/safe-load";

/**
 * GET /api/v1/admin/descuentos/opciones — productos y categorías para elegir
 * a qué aplica un cupón en el formulario de la app (2026-10-31). Permiso
 * descuentos/ver; mismas fuentes que /admin/descuentos (`listProductsForSale`
 * = todo lo no archivado, `listCategoriesAdmin`).
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/descuentos/opciones",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "descuentos", "ver");
    if ("response" in auth) return auth.response;

    const [products, categories] = await loadOrThrow(
      "api:descuentos/opciones",
      Promise.all([listProductsForSale(), listCategoriesAdmin()]),
    );
    return apiOk({
      products: products.map((p) => ({ id: p.id, name: p.name })),
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    });
  },
);
