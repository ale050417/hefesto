import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { canForUser } from "@/core/auth/permissions";
import { addInquiryFile } from "@/features/consultas/flow";
import { businessError } from "@/features/inventory/api-helpers";

/**
 * POST /api/v1/admin/consultas/:id/files — suma UN adjunto que no es foto
 * (audio, video corto o PDF; hasta 4 MB) a la consulta. Multipart, campo
 * `file`. Lo puede sumar quien cargó la consulta o quien puede responderla.
 * Devuelve `{ url, name, type }`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(
  "admin/consultas/files",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "ver");
    if ("response" in auth) return auth.response;
    const [canCreate, canEdit] = await Promise.all([
      canForUser(auth.user, "consultas", "crear"),
      canForUser(auth.user, "consultas", "editar"),
    ]);
    if (!canCreate && !canEdit) {
      return apiError("forbidden", "No tenés permiso para hacer esto.");
    }
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File))
      return apiError("invalid", "Falta el archivo.");
    try {
      const saved = await addInquiryFile(
        id.data,
        {
          bytes: Buffer.from(await file.arrayBuffer()),
          name: file.name,
          type: file.type,
        },
        apiActor(auth.user),
        canEdit,
      );
      return apiOk(saved, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
