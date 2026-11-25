import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { inquiryProduct } from "@/features/consultas/product-prefill";
import { normalizeSearch } from "@/features/orders/sale-catalog";
import { listProductsForSale } from "@/features/products/services/catalogService";

/**
 * GET /api/v1/admin/consultas/products — productos ya cargados para responder
 * una consulta sin tipear todo (sugerencia de Agustín, 2026-11-19). Permiso
 * consultas/editar (el operador). Cada producto trae precio de la tienda,
 * medidas, demora, colores y los gramos/minutos con los que se costea el
 * pedido; nunca el costo ni el margen.
 * Query: q (nombre o categoría), limit (máx 60).
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().positive().max(60).default(30),
});

export const GET = withApi(
  "admin/consultas/products",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "consultas", "editar");
    if ("response" in auth) return auth.response;

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return apiError("invalid", "Búsqueda inválida.");
    const { q, limit } = parsed.data;

    const products = await listProductsForSale();
    const needle = q ? normalizeSearch(q) : "";
    const matches = needle
      ? products.filter((p) =>
          normalizeSearch(`${p.name} ${p.categoryName ?? ""}`).includes(needle),
        )
      : products;

    return apiOk({
      total: matches.length,
      items: matches.slice(0, limit).map(inquiryProduct),
    });
  },
);
