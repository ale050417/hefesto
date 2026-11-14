import { apiError, apiOk, PUBLIC_CACHE, withApi } from "@/core/api/respond";
import { productFilterSchema } from "@/features/products/schemas";
import {
  listCategories,
  listMaterials,
  listProducts,
} from "@/features/products/services/catalogService";

/**
 * GET /api/v1/products — catálogo público paginado (app móvil, 2026-10-31).
 * Query: q, category (slug), material, minPrice, maxPrice, isNew, onSale,
 * sort (newest|price_asc|price_desc|name), page, pageSize (máx 48).
 * `?facets=1` agrega categorías, materiales y el precio más alto del catálogo
 * (`priceMax`, para el tope del filtro de precio) para armar los filtros.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("products", async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const parsed = productFilterSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return apiError("invalid", "Filtros inválidos.", parsed.error.flatten());
  }

  const page = await listProducts(parsed.data);

  if (params.get("facets") === "1") {
    const [categories, materials, priciest] = await Promise.all([
      listCategories(),
      listMaterials(),
      // El producto más caro: la app usa su precio como tope del filtro (antes
      // el tope era fijo en $100.000 y había productos por encima, 2026-11-14).
      listProducts({ sort: "price_desc", page: 1, pageSize: 1 }),
    ]);
    const top = priciest.items[0];
    return apiOk(
      {
        ...page,
        facets: {
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
          })),
          materials,
          priceMax: top ? Math.max(top.price, top.displayPrice) : null,
        },
      },
      PUBLIC_CACHE,
    );
  }

  return apiOk(page, PUBLIC_CACHE);
});
