import { after } from "next/server";
import { recordAudit } from "@/core/audit";
import { notifyCustomer } from "@/features/notifications/service";
import { awardForOrder } from "@/features/rewards/service";
import { ORDER_STATUS_LABEL } from "./constants";
import { transitionOrder } from "./services/orderAdminService";
import { notifyOrderStatus } from "./services/orderEmails";
import type { OrderStatus } from "./types";

/**
 * Cambio de estado de un pedido CON todos sus efectos (2026-10-31, pedido de
 * Ale: app móvil). Antes vivía inline en `transitionOrderAction`; se extrajo
 * para que la web (Server Action) y la API de la app (`/api/v1/admin/...`)
 * hagan EXACTAMENTE lo mismo: máquina de estados + email + notificación al
 * cliente + puntos al confirmar + auditoría.
 *
 * La AUTORIZACIÓN (permiso "pedidos/editar" y "cancelar/reembolsar = solo
 * admin") la valida cada caller antes de llamar acá; esta función asume que ya
 * pasó. Los efectos no críticos corren DESPUÉS de responder (`after`) y cada
 * uno atrapa su propio error: guardar no espera viajes de red.
 */
export async function changeOrderStatus(params: {
  orderId: string;
  toStatus: OrderStatus;
  note?: string | null;
  actorId: string | null;
}) {
  const { orderId, toStatus, note, actorId } = params;
  const updated = await transitionOrder(orderId, toStatus, {
    changedBy: actorId,
    note: note ?? null,
  });

  after(async () => {
    try {
      await notifyOrderStatus(updated);
    } catch (mailError) {
      console.error("[email] no se pudo notificar el estado:", mailError);
    }
    try {
      await notifyCustomer({
        customerId: updated.customerId,
        title: `Tu pedido ${updated.orderNumber} cambió de estado`,
        body: `Ahora está: ${ORDER_STATUS_LABEL[updated.status]}.`,
        link: `/cuenta/pedidos/${updated.orderNumber}`,
      });
    } catch (notifError) {
      console.error("[notif] no se pudo crear la notificación:", notifError);
    }
    if (updated.status === "confirmed") {
      try {
        await awardForOrder({
          customerId: updated.customerId,
          orderId: updated.id,
          orderTotal: Number(updated.total),
        });
      } catch (rwErr) {
        console.error("[rewards] no se pudieron otorgar puntos:", rwErr);
      }
    }
    try {
      await recordAudit({
        actorId,
        action: "order.status_changed",
        entityType: "order",
        entityId: orderId,
        metadata: { toStatus, ...(note ? { note } : {}) },
      });
    } catch (auditError) {
      console.error("[audit] no se pudo registrar el cambio:", auditError);
    }
  });

  return updated;
}
