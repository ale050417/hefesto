import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import {
  businessErrorResponse,
  readBody,
  requireTeamAdmin,
} from "@/features/settings/api-helpers";
import { createRoleSchema } from "@/features/settings/schemas";
import { createRole } from "@/features/settings/service";

/**
 * POST /api/v1/admin/configuracion/roles { name, permissions } — crea un rol
 * con permisos por módulo ({ pedidos: ["ver","editar"], … }; lo desconocido se
 * descarta). SOLO administradores (igual que `createRoleAction`).
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/configuracion/roles",
  async (request: Request) => {
    const auth = await requireTeamAdmin(
      request,
      "Solo un administrador puede crear roles.",
    );
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      createRoleSchema,
      "Revisá el nombre y los permisos.",
    );
    if ("response" in body) return body.response;

    try {
      await createRole({
        name: body.data.name,
        permissions: body.data.permissions,
      });
      revalidatePath("/admin/configuracion");
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
