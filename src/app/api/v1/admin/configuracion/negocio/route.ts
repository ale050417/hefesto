import { revalidatePath } from "next/cache";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import {
  emptyToNull,
  readBody,
  requireConfigEdit,
} from "@/features/settings/api-helpers";
import { negocioPatchSchema } from "@/features/settings/api-schemas";
import {
  saveBusinessInfo,
  type BusinessInfoPatch,
} from "@/features/settings/service";

/**
 * PATCH /api/v1/admin/configuracion/negocio — datos del negocio (nombre,
 * eslogan, contacto, redes, dirección, horarios). Parcial: solo se guardan los
 * campos que vienen; "" borra el dato. Permiso config/editar y mismos efectos
 * que `saveBusinessInfoAction` (la tienda lee la marca del layout, por eso se
 * revalida todo).
 */
export const dynamic = "force-dynamic";

export const PATCH = withApi(
  "admin/configuracion/negocio",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      negocioPatchSchema,
      "Revisá los datos.",
    );
    if ("response" in body) return body.response;
    const d = body.data;

    const patch: BusinessInfoPatch = {};
    if (d.storeName !== undefined) patch.storeName = emptyToNull(d.storeName);
    if (d.slogan !== undefined) patch.slogan = emptyToNull(d.slogan);
    if (d.description !== undefined)
      patch.description = emptyToNull(d.description);
    if (d.whatsapp !== undefined) patch.whatsapp = emptyToNull(d.whatsapp);
    if (d.contactEmail !== undefined)
      patch.contactEmail = emptyToNull(d.contactEmail);
    if (d.addressText !== undefined)
      patch.addressText = emptyToNull(d.addressText);
    if (d.instagram !== undefined) patch.instagram = emptyToNull(d.instagram);
    if (d.tiktok !== undefined) patch.facebook = emptyToNull(d.tiktok);
    if (d.cuit !== undefined) patch.cuit = emptyToNull(d.cuit);
    if (d.hours !== undefined) patch.hours = d.hours;
    if (Object.keys(patch).length === 0) {
      return apiError("invalid", "No hay nada para guardar.");
    }

    await saveBusinessInfo(patch);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
