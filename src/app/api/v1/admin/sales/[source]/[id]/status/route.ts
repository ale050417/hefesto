import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { isAdminForUser } from "@/core/auth/permissions";
import { recordAudit } from "@/core/audit";
import { AppError } from "@/core/errors";
import { orderStatusSchema } from "@/features/orders/schemas";
import { changeOrderStatus } from "@/features/orders/status-flow";
import { updateManualSaleStatus } from "@/features/orders/services/manualSaleService";

/**
 * POST /api/v1/admin/sales/:source/:id/status — cambia el estado de un pedido
 * online (`source=online`) o de una venta manual (`source=manual`) desde la
 * app (2026-10-31). Mismas reglas que el panel web:
 *  - permiso pedidos/editar;
 *  - cancelar / reembolsar toca plata: SOLO admin (Cap. 8 B4, 11 y 12);
 *  - online: máquina de estados + email + notificación + puntos + auditoría
 *    (`changeOrderStatus`, compartido con la Server Action).
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: orderStatusSchema,
  note: z.string().trim().max(300).optional(),
});

export const POST = withApi(
  "admin/sales/status",
  async (
    request: Request,
    ctx: { params: Promise<{ source: string; id: string }> },
  ) => {
    const auth = await requireApiPerm(request, "pedidos", "editar");
    if ("response" in auth) return auth.response;

    const { source, id } = await ctx.params;
    if (source !== "online" && source !== "manual") {
      return apiError("invalid", "Tipo de venta inválido.");
    }
    if (!z.uuid().safeParse(id).success) {
      return apiError("invalid", "Venta inválida.");
    }
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("invalid", "Estado inválido.");
    const { status, note } = body.data;

    if (
      (status === "cancelled" || status === "refunded") &&
      !(await isAdminForUser(auth.user))
    ) {
      return apiError(
        "forbidden",
        "Cancelar o reembolsar pedidos es solo para administradores.",
      );
    }

    try {
      if (source === "online") {
        await changeOrderStatus({
          orderId: id,
          toStatus: status,
          note,
          actorId: auth.user.id,
        });
      } else {
        await updateManualSaleStatus(id, status, note ?? null);
        await recordAudit({
          actorId: auth.user.id,
          action: "manual_sale.status_changed",
          entityType: "manual_sale",
          entityId: id,
          metadata: { status },
        });
      }
      return apiOk({ ok: true });
    } catch (error) {
      // Errores de negocio (transición inválida, falta tracking, etc.) vuelven
      // con su mensaje en castellano; lo inesperado cae al 503 genérico.
      if (error instanceof AppError) {
        return apiError(
          error.code === "NOT_FOUND" ? "not_found" : "invalid",
          error.message,
        );
      }
      throw error;
    }
  },
);
