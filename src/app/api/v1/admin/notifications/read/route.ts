import { apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { markAdminSeen } from "@/features/notifications/service";

/**
 * POST /api/v1/admin/notifications/read — marca todos los avisos como leídos
 * PARA quien consulta (el "no leído" es de cada persona, no del equipo).
 * Sin body. Responde { "ok": true }.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/notifications/read",
  async (request: Request) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    await markAdminSeen(auth.user.id);
    return apiOk({ ok: true });
  },
);
