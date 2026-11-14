import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { ValidationError } from "@/core/errors";
import { changeOrderStatus } from "@/features/orders/status-flow";
import { updateManualSaleStatus } from "@/features/orders/services/manualSaleService";
import type { OrderStatus } from "@/features/orders/types";
import { BOARD_STATES } from "./board";

/**
 * Mueve una tarjeta de la cola de producción a otra etapa (app móvil,
 * 2026-10-31). Hace lo mismo que arrastrar la tarjeta en `/admin/produccion`:
 *  - online → `changeOrderStatus` (máquina de estados + email + notificación +
 *    puntos al confirmar + auditoría), igual que `transitionOrderAction`;
 *  - manual → `updateManualSaleStatus` + auditoría, igual que
 *    `updateManualSaleStatusAction`.
 * Confirmar el pago descuenta el filamento (idempotente por el ledger).
 *
 * La AUTORIZACIÓN (pedidos/editar) la valida el caller. Desde la cola solo se
 * pasa entre las etapas del taller: cancelar o reembolsar (que tocan plata y
 * son solo de administradores) no son columnas del tablero y se hacen desde
 * Ventas.
 */
export async function moveBoardCard(params: {
  source: "online" | "manual";
  id: string;
  status: OrderStatus;
  actorId: string | null;
}): Promise<void> {
  const { source, id, status, actorId } = params;
  if (!BOARD_STATES.includes(status)) {
    throw new ValidationError(
      "Desde la cola solo se pasa entre las etapas del taller. Cancelar o reembolsar se hace desde Ventas.",
    );
  }

  if (source === "online") {
    await changeOrderStatus({ orderId: id, toStatus: status, actorId });
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin/pedidos");
  } else {
    await updateManualSaleStatus(id, status, null);
    await recordAudit({
      actorId,
      action: "manual_sale.status_changed",
      entityType: "manual_sale",
      entityId: id,
      metadata: { status },
    });
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
  }
  revalidatePath("/admin/produccion");
}
