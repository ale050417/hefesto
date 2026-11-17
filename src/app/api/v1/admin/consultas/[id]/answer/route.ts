import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { answerInquiry } from "@/features/consultas/flow";
import { inquiryAnswerSchema } from "@/features/consultas/schemas";
import { toInquiryView } from "@/features/consultas/view";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";

/**
 * POST /api/v1/admin/consultas/:id/answer — respuesta del operador
 * (consultas/editar). Guarda precio y datos y deja armado el mensaje para el
 * cliente: sin `message` lo arma el servidor con el formato de cotización;
 * con `message`, queda el texto que mandó la app. Devuelve la consulta.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(
  "admin/consultas/answer",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    const parsed = inquiryAnswerSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await answerInquiry(
        id.data,
        parsed.data,
        apiActor(auth.user),
      );
      return apiOk(toInquiryView(row, auth.user.id));
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
