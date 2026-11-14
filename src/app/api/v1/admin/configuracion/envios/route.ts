import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import {
  emptyToNull,
  readBody,
  requireConfigEdit,
} from "@/features/settings/api-helpers";
import { enviosSchema } from "@/features/settings/api-schemas";
import {
  saveBusinessInfo,
  saveShippingSettings,
} from "@/features/settings/service";

/**
 * PUT /api/v1/admin/configuracion/envios — ciudad de envío, envío gratis desde,
 * mensaje "fuera de la ciudad", barrios con precio y los switches de retiro en
 * local / envío a domicilio. Permiso config/editar. La lista de barrios se
 * reemplaza entera (los de nombre vacío se descartan), como en la web.
 * Los switches viven en `business_settings` (se guardan igual que en la
 * pestaña Negocio, y por eso también revalidan la tienda).
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/configuracion/envios",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      enviosSchema,
      "Revisá los datos de envío.",
    );
    if ("response" in body) return body.response;
    const d = body.data;

    await saveShippingSettings({
      city: emptyToNull(d.city),
      freeOver: d.freeOver,
      outMsg: emptyToNull(d.outMsg),
      zones: d.zones.filter((z) => z.name.trim().length > 0),
    });
    revalidatePath("/admin/configuracion");

    if (d.pickupEnabled !== undefined || d.deliveryEnabled !== undefined) {
      await saveBusinessInfo({
        ...(d.pickupEnabled !== undefined
          ? { pickupEnabled: d.pickupEnabled }
          : {}),
        ...(d.deliveryEnabled !== undefined
          ? { deliveryEnabled: d.deliveryEnabled }
          : {}),
      });
      revalidatePath("/", "layout");
    }
    return apiOk({ ok: true });
  },
);
