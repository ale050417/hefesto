import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { listTeamTasks } from "@/features/pendientes/queries";
import { TASK_BODY_MAX, taskCreateSchema } from "@/features/pendientes/schemas";
import { createTask } from "@/features/pendientes/service";
import { toTaskView } from "@/features/pendientes/view";

/**
 * /api/v1/admin/pendientes — "Pendientes del equipo" de Pedidos (app móvil,
 * 2026-11-17, pedido de Agustín). Mismo servicio que el panel web. Usa los
 * permisos del módulo `pedidos`.
 *
 *  - GET  → listas (pedidos/ver):
 *      {
 *        "open": [Task, ...],   // sin tildar, los más nuevos primero
 *        "done": [Task, ...],   // los últimos 20 tildados, el más reciente primero
 *        "maxLength": 500       // largo máximo del texto
 *      }
 *  - POST → anota un pendiente (pedidos/crear). Body: { "body": "texto" }
 *           (1 a 500 caracteres). Responde 201 con el Task creado.
 *
 * Task:
 *      {
 *        "id": "uuid",
 *        "body": "Cargar el pedido de Nico (2 llaveros)",
 *        "done": false,
 *        "author": "Agustín",                      // quién lo anotó
 *        "mine": true,                             // lo anotó quien consulta: puede borrarlo
 *        "createdAt": "2026-11-17T14:03:11.000Z",  // ISO 8601, UTC
 *        "doneBy": null,                           // quién lo tildó (string) o null
 *        "doneAt": null                            // ISO 8601 o null
 *      }
 *
 * Errores: el contrato de siempre, { "error": { "code", "message" } }
 * (422 `invalid` trae además `details.fields.body`).
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/pendientes", async (request: Request) => {
  const auth = await requireApiPerm(request, "pedidos", "ver");
  if ("response" in auth) return auth.response;
  const lists = await listTeamTasks(auth.user.id);
  return apiOk({ ...lists, maxLength: TASK_BODY_MAX });
});

export const POST = withApi(
  "admin/pendientes/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "pedidos", "crear");
    if ("response" in auth) return auth.response;
    const parsed = taskCreateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await createTask(parsed.data, apiActor(auth.user));
      return apiOk(toTaskView(row, auth.user.id), { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
