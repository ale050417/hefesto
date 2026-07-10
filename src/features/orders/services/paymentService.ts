import { InvalidTransitionError } from "@/core/errors";
import type {
  CreatePreferenceParams,
  CreatedPreference,
} from "@/core/payments/mercadopago";
import type { Order, OrderWithItems } from "../types";
import { awardForOrder } from "@/features/rewards/service";
import { OrderError } from "./orderService";

export type StartPaymentResult = { redirectUrl: string; preferenceId: string };

// Dependencias inyectables (igual que en orderService) para testear sin red/DB.
export type PaymentDeps = {
  getOrder: (id: string) => Promise<OrderWithItems | null>;
  createPreference: (p: CreatePreferenceParams) => Promise<CreatedPreference>;
};

const defaultDeps: PaymentDeps = {
  getOrder: (id) => import("../repository").then((m) => m.findOrderById(id)),
  createPreference: (p) =>
    import("@/core/payments/mercadopago").then((m) => m.createPreference(p)),
};

/**
 * Inicia el pago con MercadoPago para un pedido ya creado. El monto sale de la
 * base (snapshots), nunca del cliente (Cap. 13). external_reference = id del
 * pedido, para que el webhook (Paso 38) lo encuentre.
 */
export async function startMercadoPagoPayment(
  orderId: string,
  opts: { siteUrl: string; payerEmail?: string },
  deps: PaymentDeps = defaultDeps,
): Promise<StartPaymentResult> {
  const order = await deps.getOrder(orderId);
  if (!order) throw new OrderError("NOT_FOUND", "No encontramos el pedido.");

  const items = order.items.map((it) => ({
    title: it.variantLabel
      ? `${it.productName} (${it.variantLabel})`
      : it.productName,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
  }));

  try {
    const pref = await deps.createPreference({
      externalReference: order.id,
      items,
      backUrls: {
        success: `${opts.siteUrl}/checkout/exito?pedido=${encodeURIComponent(order.orderNumber)}`,
        failure: `${opts.siteUrl}/checkout?pago=fallido`,
        pending: `${opts.siteUrl}/checkout/exito?pedido=${encodeURIComponent(order.orderNumber)}`,
      },
      notificationUrl: `${opts.siteUrl}/api/webhooks/mercadopago`,
      ...(opts.payerEmail ? { payerEmail: opts.payerEmail } : {}),
    });
    return { redirectUrl: pref.initPoint, preferenceId: pref.id };
  } catch (error) {
    console.error("[checkout] MercadoPago falló:", error);
    throw new OrderError(
      "PAYMENT_ERROR",
      "No pudimos iniciar el pago con MercadoPago. Probá de nuevo.",
    );
  }
}

// Confirmación del pago (la dispara el webhook). Idempotente: si el pedido ya
// salió de pending_payment, no hace nada.
export type ConfirmPaymentDeps = {
  getOrder: (id: string) => Promise<OrderWithItems | null>;
  markPaid: (params: {
    orderId: string;
    fromStatus: "pending_payment";
    toStatus: "confirmed";
    paidAt: Date;
    note: string;
  }) => Promise<Order>;
  /** Pago acreditado → descuenta filamento (idempotente; nunca lanza). */
  deductFilament?: (orderId: string) => Promise<unknown>;
};

const confirmDeps: ConfirmPaymentDeps = {
  getOrder: (id) => import("../repository").then((m) => m.findOrderById(id)),
  markPaid: (params) =>
    import("../repository").then((m) => m.updateOrderStatus(params)),
  deductFilament: (orderId) =>
    import("./orderInventory").then((m) => m.deductFilamentForOrder(orderId)),
};

/**
 * Marca un pedido como pagado (pending_payment → confirmed) y registra la
 * transición. Si ya fue procesado, devuelve el pedido sin cambios (idempotencia
 * para reintentos del webhook).
 */
export async function confirmOrderPayment(
  orderId: string,
  deps: ConfirmPaymentDeps = confirmDeps,
): Promise<Order> {
  const order = await deps.getOrder(orderId);
  if (!order) throw new OrderError("NOT_FOUND", "No encontramos el pedido.");
  if (order.status !== "pending_payment") return order;

  let updated: Order;
  try {
    updated = await deps.markPaid({
      orderId: order.id,
      fromStatus: "pending_payment",
      toStatus: "confirmed",
      paidAt: new Date(),
      note: "Pago aprobado (MercadoPago)",
    });
  } catch (error) {
    // Otro reintento del webhook (u otro proceso) confirmó primero: el update
    // condicional no matcheó. Idempotencia: devolvemos el pedido como quedó.
    if (error instanceof InvalidTransitionError) {
      const again = await deps.getOrder(orderId);
      if (again) return again;
    }
    throw error;
  }
  try {
    await awardForOrder({
      customerId: updated.customerId,
      orderId: updated.id,
      orderTotal: Number(updated.total),
    });
  } catch (e) {
    console.error("[rewards] no se pudieron otorgar puntos:", e);
  }
  // Pago acreditado = la pieza se va a imprimir: descuenta filamento (diseño
  // 2026-07). Solo corre en el camino que GANÓ el compare-and-set; los
  // reintentos del webhook vuelven antes (idempotencia doble: acá y ledger).
  await deps.deductFilament?.(updated.id);
  return updated;
}

// Cancela un pedido que quedó pendiente porque el pago nunca se inició (evita
// pedidos "huérfanos"). Idempotente: solo actúa sobre pending_payment.
export type CancelPendingDeps = {
  getOrder: (id: string) => Promise<OrderWithItems | null>;
  markCancelled: (params: {
    orderId: string;
    fromStatus: "pending_payment";
    toStatus: "cancelled";
    note: string;
  }) => Promise<Order>;
};

const cancelDeps: CancelPendingDeps = {
  getOrder: (id) => import("../repository").then((m) => m.findOrderById(id)),
  markCancelled: (params) =>
    import("../repository").then((m) => m.updateOrderStatus(params)),
};

export async function cancelPendingOrder(
  orderId: string,
  deps: CancelPendingDeps = cancelDeps,
): Promise<Order> {
  const order = await deps.getOrder(orderId);
  if (!order) throw new OrderError("NOT_FOUND", "No encontramos el pedido.");
  if (order.status !== "pending_payment") return order;

  try {
    return await deps.markCancelled({
      orderId: order.id,
      fromStatus: "pending_payment",
      toStatus: "cancelled",
      note: "Pago no iniciado (MercadoPago)",
    });
  } catch (error) {
    // Idempotencia ante carrera: si alguien lo movió primero, devolvemos el
    // estado actual en vez de fallar.
    if (error instanceof InvalidTransitionError) {
      const again = await deps.getOrder(orderId);
      if (again) return again;
    }
    throw error;
  }
}
