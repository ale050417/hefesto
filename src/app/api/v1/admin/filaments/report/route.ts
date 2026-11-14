import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listFilamentsView } from "@/features/inventory/queries";
import { buildFilamentReport } from "@/features/inventory/report";

/**
 * GET /api/v1/admin/filaments/report — informe de stock en texto para copiar o
 * mandar por WhatsApp (app móvil, 2026-10-31). Es el MISMO texto que arma el
 * botón "Informe" de /admin/filamentos (`buildFilamentReport`) sobre todo el
 * inventario. Permiso filamentos/ver.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/filaments/report",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;

    const filaments = await listFilamentsView();
    return apiOk({ text: buildFilamentReport(filaments, new Date()) });
  },
);
