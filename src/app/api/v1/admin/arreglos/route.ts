import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { listFixes } from "@/features/arreglos/queries";
import {
  FIX_STATUS_LABEL,
  MAX_FIX_IMAGES,
  fixCreateSchema,
} from "@/features/arreglos/schemas";
import { createFix } from "@/features/arreglos/service";
import { toFixView } from "@/features/arreglos/view";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";

/**
 * /api/v1/admin/arreglos — lo que hay que arreglar o mejorar (app móvil,
 * 2026-11-17). Mismo servicio que el panel web.
 *  - GET  → lista (arreglos/ver).
 *  - POST → carga un arreglo (arreglos/crear). Las fotos se suben después a
 *           /arreglos/:id/images, de a una.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/arreglos", async (request: Request) => {
  const auth = await requireApiPerm(request, "arreglos", "ver");
  if ("response" in auth) return auth.response;
  const rows = await listFixes();
  return apiOk({
    items: rows.map((r) => toFixView(r, auth.user.id)),
    statuses: FIX_STATUS_LABEL,
    maxImages: MAX_FIX_IMAGES,
  });
});

export const POST = withApi(
  "admin/arreglos/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "arreglos", "crear");
    if ("response" in auth) return auth.response;
    const parsed = fixCreateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await createFix(parsed.data, apiActor(auth.user));
      return apiOk(toFixView(row, auth.user.id), { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
