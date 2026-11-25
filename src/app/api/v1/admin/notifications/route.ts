import { apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { getResolveInputForUser } from "@/core/auth/permissions";
import { getAdminNotifications } from "@/features/notifications/service";

/**
 * GET /api/v1/admin/notifications — avisos del panel para quien consulta
 * (sugerencia de Agustín, 2026-11-22). Cualquier cuenta del equipo.
 *
 *   {
 *     "items": [            // más nuevos primero, máx. 30
 *       {
 *         "id": "uuid",
 *         "kind": "inquiry",          // ver features/notifications/kinds.ts
 *         "title": "Consulta nueva",
 *         "body": "Antonella: Trofeo (x4) — Sabunim Itati",   // o null
 *         "link": "/admin/consultas",                          // o null
 *         "unread": true,             // posterior a la última lectura de ESTA persona
 *         "createdAt": "2026-11-25T14:03:00.000Z"
 *       }
 *     ],
 *     "unread": 3,
 *     "kinds": [            // los tipos que esta persona puede ver, con su interruptor
 *       { "key": "inquiry", "label": "Consultas nuevas",
 *         "description": "Cuando atención al cliente carga una consulta para cotizar.",
 *         "enabled": true }
 *     ]
 *   }
 *
 * Ya viene filtrado: solo los tipos que la persona puede ver por sus permisos
 * y no apagó, y sin los avisos que generó ella misma.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/notifications", async (request: Request) => {
  const auth = await requireApiStaff(request);
  if ("response" in auth) return auth.response;
  const perms = await getResolveInputForUser(auth.user);
  return apiOk(await getAdminNotifications(auth.user.id, perms));
});
