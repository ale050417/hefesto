"use server";

import { type ZodError } from "zod";
import { getCurrentUser } from "@/core/auth/session";
import { toActionError } from "@/core/errors";
import { siteUrl } from "@/lib/site";
import { checkoutSchema, type CheckoutInput } from "./schemas";
import { createOrder } from "./services/orderService";
import {
  cancelPendingOrder,
  startMercadoPagoPayment,
} from "./services/paymentService";

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
