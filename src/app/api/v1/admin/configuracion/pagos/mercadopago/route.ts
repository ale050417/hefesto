import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import { readBody, requireConfigEdit } from "@/features/settings/api-helpers";
import { mpTokenSchema } from "@/features/settings/schemas";
import { saveMpAccessToken } from "@/features/settings/service";

/**
 * PUT    /api/v1/admin/configuracion/pagos/mercadopago  { token } — conecta.
 * DELETE /api/v1/admin/configuracion/pagos/mercadopago           — desconecta.
 * Permiso config/editar; mismos efectos que `saveMpTokenAction` /
 * `disconnectMpAction`. SEGURIDAD: el token solo entra; la respuesta no lo
 * devuelve y no se loguea.
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/configuracion/pagos/mercadopago",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      mpTokenSchema,
      "El token no parece válido (muy corto).",
    );
    if ("response" in body) return body.response;

    await saveMpAccessToken(body.data.token);
    revalidatePath("/admin/configuracion");
    revalidatePath("/checkout");
    return apiOk({ ok: true, mpConnected: true });
  },
);

export const DELETE = withApi(
  "admin/configuracion/pagos/mercadopago/delete",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    await saveMpAccessToken(null);
    revalidatePath("/admin/configuracion");
    revalidatePath("/checkout");
    return apiOk({ ok: true, mpConnected: false });
  },
);
