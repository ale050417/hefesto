import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import { readBody, requireConfigEdit } from "@/features/settings/api-helpers";
import { textosPatchSchema } from "@/features/settings/api-schemas";
import { saveAppearance } from "@/features/settings/service";

/**
 * PATCH /api/v1/admin/configuracion/textos — textos clave del home: la banda
 * de confianza (`trustBar`) y/o las preguntas frecuentes (`faq`). Cada una se
 * guarda por separado (alcanza con mandar la que cambió). Permiso
 * config/editar; mismos efectos que `saveTrustBarAction` / `saveFaqAction`.
 */
export const dynamic = "force-dynamic";

export const PATCH = withApi(
  "admin/configuracion/textos",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(
      request,
      textosPatchSchema,
      "Revisá los textos.",
    );
    if ("response" in body) return body.response;
    const d = body.data;

    if (d.trustBar !== undefined)
      await saveAppearance({ trustBar: d.trustBar });
    if (d.faq !== undefined) await saveAppearance({ faq: d.faq });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
