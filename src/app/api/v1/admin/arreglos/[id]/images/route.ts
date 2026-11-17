import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor, readImageUpload } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { addFixImage } from "@/features/arreglos/service";
import { businessError } from "@/features/inventory/api-helpers";

/**
 * POST /api/v1/admin/arreglos/:id/images — suma UNA foto al arreglo
 * (multipart, campo `file`). arreglos/crear; solo quien lo cargó o quien
 * puede editar arreglos. Devuelve `{ url }`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(
  "admin/arreglos/images",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "arreglos", "crear");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Arreglo inválido.");
    const upload = await readImageUpload(request);
    if ("response" in upload) return upload.response;
    try {
      const url = await addFixImage(
        id.data,
        upload.bytes,
        apiActor(auth.user),
        await canForUser(auth.user, "arreglos", "editar"),
      );
      return apiOk({ url }, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
