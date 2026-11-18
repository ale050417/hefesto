import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { taskDoneSchema } from "@/features/pendientes/schemas";
import { deleteTask, setTaskDone } from "@/features/pendientes/service";
import { toTaskView } from "@/features/pendientes/view";

/**
 * /api/v1/admin/pendientes/:id (app móvil, 2026-11-17, pedido de Agustín).
 *
 *  - PATCH  → tilda o destilda (pedidos/crear; cualquiera del equipo, no solo
 *             quien lo anotó). Body: { "done": true | false }. Responde 200 con
 *             el Task actualizado (misma forma que en GET /pendientes: id, body,
 *             done, author, mine, createdAt, doneBy, doneAt; fechas ISO 8601).
 *             404 `not_found` si alguien lo borró mientras tanto.
 *  - DELETE → borra el pendiente: quien lo anotó (`mine`) o quien tiene
 *             pedidos/eliminar (lo decide el servicio; si no, 403 `forbidden`).
 *             Responde { "ok": true }, también si ya estaba borrado.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/pendientes/update",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "pedidos", "crear");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Pendiente inválido.");
    const parsed = taskDoneSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await setTaskDone(
        id.data,
        parsed.data.done,
        apiActor(auth.user),
      );
      return apiOk(toTaskView(row, auth.user.id));
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/pendientes/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "pedidos", "ver");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Pendiente inválido.");
    try {
      await deleteTask(
        id.data,
        apiActor(auth.user),
        await canForUser(auth.user, "pedidos", "eliminar"),
      );
      return apiOk({ ok: true });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
