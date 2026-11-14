import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiStaff, withApi } from "@/core/api/respond";
import { canForUser } from "@/core/auth/permissions";
import { readBody } from "@/features/settings/api-helpers";
import { cotizacionSchema } from "@/features/settings/api-schemas";
import { saveQuoteDefaults } from "@/features/quotes/service";

/**
 * PUT /api/v1/admin/configuracion/cotizacion — textos por defecto de la
 * cotización por WhatsApp (encabezado, seña y aclaraciones). Igual que
 * `saveQuoteDefaultsAction`: lo puede hacer quien edita productos O pedidos
 * (es operativo, no configuración de la tienda), no hace falta config/editar.
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/configuracion/cotizacion",
  async (request: Request) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    const allowed =
      (await canForUser(auth.user, "productos", "editar")) ||
      (await canForUser(auth.user, "pedidos", "editar"));
    if (!allowed) {
      return apiError("forbidden", "No tenés permiso para hacer esto.");
    }

    const body = await readBody(
      request,
      cotizacionSchema,
      "Revisá los textos.",
    );
    if ("response" in body) return body.response;

    await saveQuoteDefaults(body.data);
    revalidatePath("/admin", "layout");
    return apiOk({ ok: true });
  },
);
