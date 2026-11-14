import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { AppError } from "@/core/errors";
import { orderStatusSchema } from "@/features/orders/schemas";
import { moveBoardCard } from "@/features/production/board-move";

/**
 * POST /api/v1/admin/produccion/:source/:id/status — pasa una tarjeta de la
 * cola a otra etapa (app móvil, 2026-10-31). `source` = `online` | `manual`.
 * Body: `{ status }`. Es lo que hace arrastrar la tarjeta en la web, así que
 * pide el mismo permiso que las acciones que dispara: pedidos/editar (ver
 * `transitionOrderAction` y `updateManualSaleStatusAction`).
 *
 * Solo entre etapas del taller; cancelar / reembolsar no están en el tablero
 * (son solo de administradores y van por Ventas). La máquina de estados, el
 * código de seguimiento obligatorio para "enviado" y el descuento de stock al
 * confirmar los valida el servicio; sus mensajes vuelven en castellano.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: orderStatusSchema });

export const POST = withApi(
  "admin/produccion/status",
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

    try {
      await moveBoardCard({
        source,
        id,
        status: body.data.status,
        actorId: auth.user.id,
      });
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
