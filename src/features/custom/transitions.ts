import type { CustomRequestStatus } from "./types";

// Máquina de estados del pedido a medida (módulo puro, sin DB).
export const CUSTOM_TRANSITIONS: Record<
  CustomRequestStatus,
  CustomRequestStatus[]
> = {
  pending: ["quoted", "rejected"],
  quoted: ["approved", "rejected"],
  approved: ["in_production"],
  in_production: ["done"],
  done: [],
  rejected: [],
};

export function canTransitionCustom(
  from: CustomRequestStatus,
  to: CustomRequestStatus,
): boolean {
  return CUSTOM_TRANSITIONS[from].includes(to);
}

export const CUSTOM_STATUS_LABEL: Record<CustomRequestStatus, string> = {
  pending: "Pendiente",
  quoted: "Cotizada",
  approved: "Aceptada",
  in_production: "En producción",
  done: "Entregada",
  rejected: "Rechazada",
};
