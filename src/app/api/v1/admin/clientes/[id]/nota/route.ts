import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse } from "@/core/api/validate";
import { adminNoteSchema } from "@/features/customers/schemas";
import { updateCustomerNote } from "@/features/customers/service";
import { isUuid } from "@/lib/ids";

/**
 * PUT /api/v1/admin/clientes/:id/nota — nota interna del taller sobre un
 * cliente, registrado o manual (2026-10-31). Permiso clientes/editar; mismo
 * schema y efectos que `updateCustomerNoteAction`. Una nota vacía la borra.
 */
export const dynamic = "force-dynamic";

const bodySchema = adminNoteSchema.extend({
  source: z.enum(["registered", "manual"]),
});

export const PUT = withApi(
  "admin/clientes/nota",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "clientes", "editar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", "No encontramos el cliente.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("invalid", "Nota inválida.");

    try {
      await updateCustomerNote(
        id,
        parsed.data.source,
        parsed.data.note ?? null,
      );
      revalidatePath(`/admin/clientes/${id}`);
      return apiOk({ ok: true });
    } catch (error) {
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);
