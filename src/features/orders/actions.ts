"use server";

import { revalidatePath } from "next/cache";

import { type ZodError } from "zod";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { can, isAdmin } from "@/core/auth/permissions";
import { recordAudit } from "@/core/audit";
import {
  type ActionResult as CoreActionResult,
  toActionError,
} from "@/core/errors";
import { siteUrl } from "@/lib/site";
import { getAmortization } from "@/features/calculator/service";
import {
  checkoutSchema,
  manualSaleSchema,
  orderMessageSchema,
  type CheckoutInput,
} from "./schemas";
import { createOrder } from "./services/orderService";
import {
  computeManualSaleCosts,
  createManualSale,
} from "./services/manualSaleService";
import { getOrderCustomerId, sendOrderMessage } from "./services/orderChat";
import { notifyCustomer } from "@/features/notifications/service";
import { awardForOrder } from "@/features/rewards/service";
import { ORDER_STATUS_LABEL } from "./constants";
import {
  cancelPendingOrder,
  startMercadoPagoPayment,
} from "./services/paymentService";
import {
  deleteOrderAdmin,
  setOrderMeta,
  transitionOrder,
} from "./services/orderAdminService";
import { notifyOrderStatus } from "./services/orderEmails";
import type { OrderStatus } from "./types";

type ActionResult =
  | { ok: true; orderNumber: string; redirectUrl?: string }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Crea el pedido desde el checkout. Autorización y validación en el servidor:
 * - exige sesión y toma el customerId de ahí (nunca del cliente);
 * - valida el payload con Zod;
 * - delega las reglas y el recálculo de precios en OrderService.
 */
export async function createOrderAction(
  input: CheckoutInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Iniciá sesión para finalizar tu compra.",
      },
    };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos del formulario.",
        fields: fieldErrors(parsed.error),
      },
    };
  }

  try {
    const order = await createOrder({ ...parsed.data, customerId: user.id });

    // Solo MercadoPago necesita redirección al checkout externo. Transferencia
    // y efectivo quedan en pending_payment y van a la pantalla de éxito.
    if (parsed.data.paymentMethod === "mercadopago") {
      try {
        const { redirectUrl } = await startMercadoPagoPayment(order.id, {
          siteUrl,
          ...(user.email ? { payerEmail: user.email } : {}),
        });
        return { ok: true, orderNumber: order.orderNumber, redirectUrl };
      } catch (paymentError) {
        // El pago no se pudo iniciar: cancelamos el pedido para no dejarlo
        // huérfano en pending_payment.
        await cancelPendingOrder(order.id).catch(() => undefined);
        throw paymentError;
      }
    }

    return { ok: true, orderNumber: order.orderNumber };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

/**
 * Admin: registra una venta manual / histórica (mostrador o ventas previas).
 * NO usa el checkout: cliente por texto, total cargado a mano, estado a
 * elección. Se guarda en `manual_sales` (no en `orders`). Requiere staff.
 */
export async function createManualSaleAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("pedidos", "crear"))) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = manualSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos de la venta.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  // Amortización (costo) obligatoria: se calcula en el servidor desde
  // gramos/horas y el FILAMENTO elegido (por id; `material` queda de fallback
  // para cargas viejas). La calculadora cotiza UNA pieza: acá se escala por la
  // cantidad. La ganancia (total − amort total) es lo que se reparte.
  const unitAmort = await getAmortization({
    filamentId: parsed.data.filamentId ?? null,
    material: parsed.data.material ?? null,
    grams: parsed.data.grams ?? 0,
    hours: (parsed.data.printMinutes ?? 0) / 60,
  });
  if (!(unitAmort > 0)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message:
          "Cargá la amortización con la calculadora (gramos/horas y filamento).",
      },
    };
  }
  const costs = computeManualSaleCosts({
    unitAmortization: unitAmort,
    total: parsed.data.total,
    quantity: parsed.data.quantity,
  });
  const withCosts = {
    ...parsed.data,
    amortization: costs.amortization,
    profit: costs.profit,
  };
  try {
    const sale = await createManualSale(withCosts, user?.id ?? null);
    revalidatePath("/admin/pedidos");
    // La venta manual cobrada suma al reparto de ganancias y a reportes.
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    await recordAudit({
      actorId: user?.id ?? null,
      action: "manual_sale.created",
      entityType: "manual_sale",
      entityId: sale.id,
      metadata: { total: sale.total, customer: sale.customerName },
    });
    return { ok: true, orderNumber: sale.id };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin: cambia el estado de un pedido (valida máquina de estados). */
export async function transitionOrderAction(
  orderId: string,
  toStatus: OrderStatus,
  note?: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await can("pedidos", "editar"))) return NOT_STAFF;
  // Cancelar / reembolsar toca plata: SOLO admin (Cap. 8 B4, 11 y 12 del
  // Libro: "operador no cancela/reembolsa"). Guard en servidor, no en la UI.
  if (
    (toStatus === "cancelled" || toStatus === "refunded") &&
    !(await isAdmin())
  ) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Cancelar o reembolsar pedidos es solo para administradores.",
      },
    };
  }
  const user = await getCurrentUser();
  try {
    const updated = await transitionOrder(orderId, toStatus, {
      changedBy: user?.id ?? null,
      note: note ?? null,
    });
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
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    await recordAudit({
      actorId: user?.id ?? null,
      action: "order.status_changed",
      entityType: "order",
      entityId: orderId,
      metadata: { toStatus, ...(note ? { note } : {}) },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin: guarda tracking / nota interna. */
export async function updateOrderMetaAction(
  orderId: string,
  fields: { trackingCode?: string | null; internalNote?: string | null },
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await can("pedidos", "editar"))) return NOT_STAFF;
  try {
    await setOrderMeta(orderId, fields);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Admin: elimina un pedido creado por error. Destructivo y toca plata/puntos,
 * así que SOLO admin (igual criterio que cancelar/reembolsar, Cap. 11). La
 * regla de qué estados son borrables la valida el service en el servidor.
 */
export async function deleteOrderAction(
  orderId: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await isAdmin())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Eliminar pedidos es solo para administradores.",
      },
    };
  }
  const user = await getCurrentUser();
  try {
    await deleteOrderAdmin(orderId);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "order.deleted",
      entityType: "order",
      entityId: orderId,
    });
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function sendOrderMessageAction(
  orderId: string,
  input: unknown,
): Promise<CoreActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const parsed = orderMessageSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Escribí un mensaje." },
    };
  const staff = await isStaff();
  try {
    const ownerId = await getOrderCustomerId(orderId);
    if (!ownerId || (!staff && ownerId !== user.id)) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "No encontrado." },
      };
    }
    await sendOrderMessage({
      orderId,
      fromStaff: staff,
      authorId: user.id,
      body: parsed.data.body,
    });
    revalidatePath(`/cuenta/pedidos`);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
