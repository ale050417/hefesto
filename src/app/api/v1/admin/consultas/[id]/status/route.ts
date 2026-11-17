import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { changeInquiryStatus } from "@/features/consultas/flow";
import { inquiryStatusSchema } from "@/features/consultas/schemas";
import { toInquiryView } from "@/features/consultas/view";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";

/**
 * POST /api/v1/admin/consultas/:id/status — body `{ to }` con
 * "confirmed" | "cancelled" | "reopen" (consultas/crear: lo hace quien carga
 * las consultas, atención al cliente). Con "confirmed" se crea SOLO el pedido
 * en estado confirmado; `paymentMethod` ("transfer" | "mercadopago" | "cash",
 * por defecto transferencia) dice cómo paga. Devuelve la consulta, con
 * `saleId` si se creó el pedido.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi(
  "admin/consultas/status",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "crear");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    const parsed = inquiryStatusSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await changeInquiryStatus(
        id.data,
        parsed.data.to,
        apiActor(auth.user),
        parsed.data.paymentMethod,
      );
      return apiOk(toInquiryView(row, auth.user.id));
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
