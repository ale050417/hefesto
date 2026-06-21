"use server";

import { revalidatePath } from "next/cache";

import { type ZodError } from "zod";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { recordAudit } from "@/core/audit";
import {
  type ActionResult as CoreActionResult,
  toActionError,
} from "@/core/errors";
import { siteUrl } from "@/lib/site";
import { checkoutSchema, type CheckoutInput } from "./schemas";
import { messageSchema } from "@/features/custom/schemas";
import { createOrder } from "./services/orderService";
import { getOrderCustomerId, sendOrderMessage } from "./services/orderChat";
import {
  cancelPendingOrder,
  startMercadoPagoPayment,
} from "./services/paymentService";
import { setOrderMeta, transitionOrder } from "./services/orderAdminService";
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

/** Admin: cambia el estado de un pedido (valida máquina de estados). */
export async function transitionOrderAction(
  orderId: string,
  toStatus: OrderStatus,
  note?: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await isStaff())) return NOT_STAFF;
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
  if (!(await isStaff())) return NOT_STAFF;
  try {
    await setOrderMeta(orderId, fields);
    revalidatePath(`/admin/pedidos/${orderId}`);
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
  const parsed = messageSchema.safeParse(input);
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
