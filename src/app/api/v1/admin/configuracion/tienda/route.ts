import { revalidatePath } from "next/cache";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import { readBody, requireConfigEdit } from "@/features/settings/api-helpers";
import { tiendaPatchSchema } from "@/features/settings/api-schemas";
import { HOME_SECTIONS } from "@/features/settings/home-sections";
import { getSettingsStrict } from "@/features/settings/repository";
import {
  saveAppearance,
  type AppearancePatch,
} from "@/features/settings/service";

/**
 * PATCH /api/v1/admin/configuracion/tienda — apariencia de la tienda: modo
 * vidriera, color de acento, temporada (y su decoración), secciones visibles
 * del home y segundos entre banners. Parcial: solo se guardan los campos que
 * vienen. Permiso config/editar; mismos efectos que `saveAppearanceAction` /
 * `saveBannerIntervalAction` (revalida toda la tienda).
 */
export const dynamic = "force-dynamic";

export const PATCH = withApi(
  "admin/configuracion/tienda",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      tiendaPatchSchema,
      "Revisá la apariencia.",
    );
    if ("response" in body) return body.response;
    const d = body.data;

    const patch: AppearancePatch = {};
    if (d.businessMode !== undefined) patch.businessMode = d.businessMode;
    if (d.accentColor !== undefined) {
      patch.accentColor = d.accentColor ? d.accentColor : null;
    }
    if (d.season !== undefined) patch.season = d.season;
    if (d.seasonDeco !== undefined) patch.seasonDeco = d.seasonDeco;
    if (d.seasonIntensity !== undefined) {
      patch.seasonIntensity = d.seasonIntensity;
    }
    if (d.seasonDurationSec !== undefined) {
      patch.seasonDurationSec = d.seasonDurationSec;
    }
    if (d.bannerIntervalSec !== undefined) {
      patch.bannerIntervalSec = d.bannerIntervalSec;
    }
    if (d.homeSections !== undefined) {
      // Se mezcla sobre lo guardado y solo con secciones que existen: así un
      // cliente desactualizado no puede borrar ni inventar claves.
      const known = new Set(HOME_SECTIONS.map((s) => s.id));
      const current = (await getSettingsStrict())?.homeSections ?? {};
      const merged: Record<string, boolean> = { ...current };
      for (const [id, on] of Object.entries(d.homeSections)) {
        if (known.has(id)) merged[id] = on;
      }
      patch.homeSections = merged;
    }
    if (Object.keys(patch).length === 0) {
      return apiError("invalid", "No hay nada para guardar.");
    }

    await saveAppearance(patch);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
