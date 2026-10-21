import type { Receipt, ReceiptBusiness } from "./receipt";

/**
 * Textos y fechas del comprobante, compartidos por la hoja HTML
 * (receipt-document.tsx) y el PDF (pdf/receipt-pdf.tsx): lo que dice uno
 * dice el otro, sin dos copias de la misma regla. Puro, sin React.
 */

// Fechas en hora argentina aunque el servidor corra en UTC (Vercel): en un
// comprobante la fecha es un dato, no puede correrse un día por la zona.
export const TZ = "America/Argentina/Buenos_Aires";

export const dateLong = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});

export const dateTime = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});

// La venta manual se guarda con una hora sintética (mediodía): mostrarla
// sería inventar un dato. Para esas, solo el día.
export const dateOnly = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

/** Formato de los hitos: con hora en pedidos online (es real), sin hora en manuales. */
export const whenFormat = (r: Receipt) =>
  r.kind === "manual" ? dateOnly : dateTime;

export const DELIVERY_LABEL = {
  pickup: "Retiro en el taller",
  local: "Envío a domicilio",
  national: "Envío al interior",
} as const;

/** Título del bloque "Entrega" de un pedido online. */
export function deliveryTitle(r: Receipt): string {
  if (r.delivery.type) return DELIVERY_LABEL[r.delivery.type];
  return r.delivery.address ? "Envío" : "A coordinar";
}

/** Línea de contacto del taller: solo lo que está cargado en Config → Negocio. */
export function contactLine(b: ReceiptBusiness): string[] {
  return [
    b.whatsapp ? `WhatsApp ${b.whatsapp}` : null,
    b.email,
    b.instagram ? `@${b.instagram.replace(/^@/, "")}` : null,
    b.address,
    b.cuit ? `CUIT ${b.cuit}` : null,
  ].filter((c): c is string => !!c);
}

/**
 * Hitos con fecha, en el orden en que pasan. Solo los que ya ocurrieron, y
 * si dos caen en el MISMO instante (venta manual: venta = pago = entrega) se
 * muestra uno solo; repetir tres veces el mismo día no dice nada y el estado
 * ya cuenta el resto.
 */
export function milestones(
  r: Receipt,
): Array<{ label: string; value: string }> {
  const fmt = whenFormat(r);
  const rows: Array<{ label: string; value: string }> = [];
  let last: number | null = null;
  const add = (label: string, at: Date | null) => {
    if (!at || at.getTime() === last) return;
    last = at.getTime();
    rows.push({ label, value: fmt.format(at) });
  };
  add(r.kind === "online" ? "Pedido" : "Venta", r.dates.issued);
  if (r.dates.paid) add("Pago", r.dates.paid);
  else if (r.status === "pending_payment") {
    rows.push({ label: "Pago", value: "Pendiente" });
  }
  add("Listo", r.dates.ready);
  add("Enviado", r.dates.shipped);
  add(
    r.delivery.type === "pickup" ? "Retirado" : "Entregado",
    r.dates.delivered,
  );
  return rows;
}

/** "Pagado el …" / "Pago pendiente" / nada (cancelado sin pago, etc.). */
export function paidLabel(r: Receipt): string | null {
  if (r.dates.paid) return `Pagado el ${whenFormat(r).format(r.dates.paid)}`;
  if (r.status === "pending_payment") return "Pago pendiente";
  return null;
}

/** Aviso de cancelación/reembolso con su motivo, si corresponde. */
export function cancelLabel(r: Receipt): string | null {
  const cancelled = r.status === "cancelled" || r.status === "refunded";
  if (!cancelled || !r.cancelReason) return null;
  const que = r.status === "refunded" ? "reembolso" : "cancelación";
  return `Motivo de ${que}: ${r.cancelReason}`;
}

/** Qué es este papel, al pie: un ticket de compra (Ale, 2026-10-20: nada de
 *  "no válido como factura", que suena a advertencia). */
export const RECEIPT_FOOT_NOTE = "Ticket de compra";
