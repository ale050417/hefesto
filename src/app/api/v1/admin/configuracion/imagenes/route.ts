import { revalidatePath } from "next/cache";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import { readImageUpload } from "@/core/api/upload";
import { storeImage } from "@/core/storage";
import { requireConfigEdit } from "@/features/settings/api-helpers";
import { setBrandImage } from "@/features/settings/service";

/**
 * POST /api/v1/admin/configuracion/imagenes — sube una imagen de la tienda
 * desde la app (2026-11-17, Ale: "quise cambiar los banners desde el celular
 * pero no me deja"). Multipart: `file` + `kind`.
 *  - kind=logo | hero → la sube Y la deja puesta (igual que
 *    `uploadBrandImageAction` de la web).
 *  - kind=banner → solo la sube y devuelve la URL; después se crea o edita el
 *    banner con ese `imageUrl` (/configuracion/banners).
 * Permiso config/editar. Devuelve `{ url }`.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/configuracion/imagenes",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;
    const upload = await readImageUpload(request);
    if ("response" in upload) return upload.response;
    const kind = upload.form.get("kind");
    if (kind !== "logo" && kind !== "hero" && kind !== "banner") {
      return apiError("invalid", "Tipo de imagen inválido.");
    }
    const { url } = await storeImage(
      "products",
      kind === "banner"
        ? `banners/banner-${Date.now()}`
        : `brand/${kind}-${Date.now()}`,
      upload.bytes,
      kind === "logo" ? 400 : 1600,
    );
    if (kind !== "banner") {
      await setBrandImage(kind, url);
      revalidatePath("/", "layout");
      revalidatePath("/admin/configuracion");
    }
    return apiOk({ url }, { status: 201 });
  },
);
