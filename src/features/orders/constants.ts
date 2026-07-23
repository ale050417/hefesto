import type { BadgeProps } from "@/components/ui/badge";
import type { OrderStatus, PaymentMethod } from "./types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Pago confirmado",
  in_production: "En producción",
  ready: "Listo para entregar",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const ORDER_STATUS_VARIANT: Record<
  OrderStatus,
  NonNullable<BadgeProps["variant"]>
> = {
  pending_payment: "warning",
  confirmed: "info",
  in_production: "info",
  ready: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  refunded: "neutral",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: "Transferencia bancaria",
  mercadopago: "MercadoPago",
  cash: "Efectivo",
};

// Motivos estándar al cancelar/reembolsar un pedido o venta. El selector ofrece
// estos + "Otro" (texto libre). El motivo es opcional (se puede confirmar sin uno).
export const CANCEL_REASONS = [
  "El cliente se arrepintió",
  "Producto defectuoso / falla de impresión",
  "Demora en la entrega",
  "Error en el pedido / datos incorrectos",
  "No se pudo coordinar el envío o retiro",
] as const;
