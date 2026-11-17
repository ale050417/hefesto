import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import {
  emptyToNull,
  readBody,
  requireConfigEdit,
} from "@/features/settings/api-helpers";
import { bannerPatchSchema } from "@/features/settings/api-schemas";
import {
  deleteBanner,
  getAllBanners,
  updateBanner,
} from "@/features/settings/service";

/**
 * PATCH  /api/v1/admin/configuracion/banners/:id — edita los textos de un
 *        banner del hero, su alineación o lo activa/desactiva. Parcial.
 * DELETE /api/v1/admin/configuracion/banners/:id — lo elimina.
 * Permiso config/editar (el mismo que `updateBannerAction` / `deleteBannerAction`).
 * La imagen se sube antes a /configuracion/imagenes (kind=banner) y acá se
 * manda su `imageUrl`. Reordenar queda para la web.
 */
export const dynamic = "force-dynamic";

async function findBanner(id: string) {
  return (await getAllBanners()).find((b) => b.id === id) ?? null;
}

export const PATCH = withApi(
  "admin/configuracion/banners",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Banner inválido.");
    }
    const body = await readBody(
      request,
      bannerPatchSchema,
      "Revisá el banner.",
    );
    if ("response" in body) return body.response;
    const d = body.data;
    if (d.title !== undefined && d.title.length === 0) {
      return apiError("invalid", "Ingresá un título.");
    }

    if (!(await findBanner(id))) {
      return apiError("not_found", "No encontramos ese banner.");
    }

    const values: Parameters<typeof updateBanner>[1] = {};
    if (d.title !== undefined) values.title = d.title;
    if (d.subtitle !== undefined) values.subtitle = emptyToNull(d.subtitle);
    if (d.ctaText !== undefined) values.ctaText = emptyToNull(d.ctaText);
    if (d.ctaHref !== undefined) values.ctaHref = emptyToNull(d.ctaHref);
    if (d.align !== undefined) values.align = d.align;
    if (d.isActive !== undefined) values.isActive = d.isActive;
    if (d.imageUrl !== undefined) values.imageUrl = emptyToNull(d.imageUrl);
    if (d.position) values.position = d.position;
    if (Object.keys(values).length === 0) {
      return apiError("invalid", "No hay nada para guardar.");
    }

    await updateBanner(id, values);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);

export const DELETE = withApi(
  "admin/configuracion/banners/delete",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Banner inválido.");
    }
    if (!(await findBanner(id))) {
      return apiError("not_found", "No encontramos ese banner.");
    }

    await deleteBanner(id);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
