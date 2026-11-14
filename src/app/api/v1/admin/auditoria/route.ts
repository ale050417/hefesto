import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  getAuditFacets,
  parseAuditParams,
  queryAuditPage,
} from "@/core/audit/query";

/**
 * GET /api/v1/admin/auditoria — registro de auditoría para la app (2026-10-31).
 * Permiso auditoria/ver (el mismo que la página web). Solo lectura.
 *
 * Query (todo opcional):
 *   q        texto libre: acción (en castellano o código), entidad, id, persona, detalle
 *   action   código exacto de acción        entity  tipo de entidad exacto
 *   actor    uuid del autor | "sistema"     desde  ISO: solo lo posterior
 *   page     (1…)  pageSize (1…100, def. 30)
 *   facets=1 además devuelve las opciones de filtro (acciones, entidades, personas)
 * Respuesta: { items, page, pageSize, hasMore, facets? }
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/auditoria", async (request: Request) => {
  const auth = await requireApiPerm(request, "auditoria", "ver");
  if ("response" in auth) return auth.response;

  const { filters, page, pageSize, facets } = parseAuditParams(
    new URL(request.url).searchParams,
  );

  const [result, facetData] = await Promise.all([
    queryAuditPage(filters, page, pageSize),
    // Las opciones de filtro son accesorias: si fallan, la lista igual se ve.
    facets ? getAuditFacets().catch(() => null) : Promise.resolve(null),
  ]);

  return apiOk({
    items: result.items,
    page,
    pageSize,
    hasMore: result.hasMore,
    ...(facetData ? { facets: facetData } : {}),
  });
});
