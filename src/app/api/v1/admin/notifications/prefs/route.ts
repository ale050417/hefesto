import { z } from "zod";
import { apiError, apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { getResolveInputForUser } from "@/core/auth/permissions";
import { setMutedKinds } from "@/features/notifications/service";

/**
 * PUT /api/v1/admin/notifications/prefs — qué tipos de aviso apagó quien
 * consulta. Body: { "muted": ["low_stock", ...] } (la lista COMPLETA de tipos
 * apagados; [] = recibir todos). Responde { "ok": true, "kinds": [...] } con
 * la misma forma que `kinds` de GET /admin/notifications.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  muted: z.array(z.string().max(40)).max(40),
});

export const PUT = withApi(
  "admin/notifications/prefs",
  async (request: Request) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid", "Revisá los tipos de aviso.");
    }
    const perms = await getResolveInputForUser(auth.user);
    const kinds = await setMutedKinds(auth.user.id, perms, parsed.data.muted);
    return apiOk({ ok: true, kinds });
  },
);
