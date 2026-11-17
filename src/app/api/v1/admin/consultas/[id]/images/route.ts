import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor, readImageUpload } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { addInquiryImage } from "@/features/consultas/flow";
import { businessError } from "@/features/inventory/api-helpers";

/**
 * POST /api/v1/admin/consultas/:id/images — suma UNA foto de referencia
 * (multipart, campo `file`). consultas/crear; solo quien cargó la consulta o
 * quien puede responderla. Devuelve `{ url }`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(
  "admin/consultas/images",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "crear");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    const upload = await readImageUpload(request);
    if ("response" in upload) return upload.response;
    try {
      const url = await addInquiryImage(
        id.data,
        upload.bytes,
        apiActor(auth.user),
        await canForUser(auth.user, "consultas", "editar"),
      );
      return apiOk({ url }, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
