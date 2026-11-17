import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import {
  emptyToNull,
  readBody,
  requireConfigEdit,
} from "@/features/settings/api-helpers";
import { bannerCreateSchema } from "@/features/settings/api-schemas";
import { createBanner, getAllBanners } from "@/features/settings/service";

/**
 * POST /api/v1/admin/configuracion/banners — crea un banner del hero desde la
 * app (2026-11-17). Mismo schema y permiso (config/editar) que
 * `createBannerAction` de la web. La imagen se sube antes a
 * /configuracion/imagenes (kind=banner) y acá va su `imageUrl`. El banner
 * nuevo queda al final. Devuelve `{ id }`.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/configuracion/banners/create",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;
    const body = await readBody(
      request,
      bannerCreateSchema,
      "Revisá el banner.",
    );
    if ("response" in body) return body.response;
    const d = body.data;
    const last = (await getAllBanners()).reduce(
      (max, b) => Math.max(max, b.sortOrder),
      -1,
    );
    const banner = await createBanner({
      title: d.title,
      subtitle: emptyToNull(d.subtitle),
      imageUrl: emptyToNull(d.imageUrl),
      position: d.position || "50% 50%",
      align: d.align ?? "left",
      ctaText: emptyToNull(d.ctaText),
      ctaHref: emptyToNull(d.ctaHref),
      isActive: d.isActive ?? true,
      sortOrder: last + 1,
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ id: banner.id }, { status: 201 });
  },
);
