import type { manualSaleItems, manualSales } from "@/core/db/schema";
import type { ShippingAddress } from "./schemas";
import type { OrderStatus, OrderWithItems, PaymentMethod } from "./types";

/**
 * Comprobante de venta (2026-10-20, pedido de Ale: "un cliente me pidió
 * comprobante").
 *
 * Un pedido online y una venta manual se guardan distinto (cliente con cuenta
 * + historial de estados vs. cliente por texto + total cargado a mano), pero el
 * comprobante que se le da al cliente es UNO solo. Este módulo lleva los dos a
 * un modelo común. Es PURO (sin base ni React) a propósito: toca plata (los
 * totales que ve el cliente), así que se prueba sin levantar nada.
 */

export type ReceiptKind = "online" | "manual";

export type ReceiptLine = {
  name: string;
  /** Variante / colores de la línea (va debajo del nombre). */
  detail: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Receipt = {
  kind: ReceiptKind;
  id: string;
  /** Número que ve el cliente: HEF-0042 en online, VM-XXXXXXXX en manual. */
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  /** Dueño del pedido online (el cliente ve solo lo suyo). Null en manual. */
  ownerId: string | null;
  dates: {
    /** Fecha del pedido (online) o de la venta (manual). */
    issued: Date;
    paid: Date | null;
    ready: Date | null;
    shipped: Date | null;
    delivered: Date | null;
  };
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
  };
  delivery: {
    type: ShippingAddress["deliveryType"] | null;
    address: string | null;
    zone: string | null;
    /** Indicaciones que dejó el cliente al comprar (no la nota interna). */
    notes: string | null;
    trackingCode: string | null;
  };
  lines: ReceiptLine[];
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
  };
  cancelReason: string | null;
};

/** Datos del taller que encabezan el comprobante (Config → Negocio). */
export type ReceiptBusiness = {
  name: string;
  slogan: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  cuit: string | null;
  /** Dominio de la tienda, sin protocolo (va en el pie). */
  site: string;
  /**
   * Color de acento vigente (Config → Apariencia, o el de la temporada), en
   * hex. La hoja HTML lo toma sola de las variables del tema; el PDF lo
   * necesita explícito para que los dos se vean iguales. Null = dorado.
   */
  accent: string | null;
};

/** Segmento de la URL → tipo de venta: /comprobante/pedido/… y /comprobante/venta/… */
export const RECEIPT_KIND_BY_SEGMENT: Record<string, ReceiptKind> = {
  pedido: "online",
  venta: "manual",
};

/** URL del comprobante de una venta (única fuente: tablero, detalle y cuenta). */
export function receiptPath(kind: ReceiptKind, id: string): string {
  return `/comprobante/${kind === "online" ? "pedido" : "venta"}/${id}`;
}

/**
 * Número de comprobante de una venta manual. No tienen número propio (el
 * pedido online tiene HEF-XXXX), así que se deriva del id: estable, corto y
 * se puede buscar en el tablero por los primeros caracteres del id.
 */
export function manualSaleCode(id: string): string {
  return `VM-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type HistoryEntry = { toStatus: OrderStatus; createdAt: Date };

/** Última vez que el pedido ENTRÓ a `status` (si volvió a pasar, la más nueva). */
function lastStatusAt(
  history: HistoryEntry[],
  status: OrderStatus,
): Date | null {
  let found: Date | null = null;
  for (const h of history) if (h.toStatus === status) found = h.createdAt;
  return found;
}

function joinAddress(a: ShippingAddress | null): string | null {
  if (!a) return null;
  const main = [a.street, a.city, a.province]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  if (!main) return null;
  return a.postalCode?.trim() ? `${main} (CP ${a.postalCode.trim()})` : main;
}

export type OrderForReceipt = OrderWithItems & {
  customer?: { fullName: string | null; phone: string | null } | null;
};

/**
 * Comprobante de un pedido ONLINE. El nombre y el teléfono salen primero de
 * la entrega (lo que el cliente escribió al comprar) y si no, del perfil. Las
 * fechas de "cuándo salió" vienen del historial de estados, que es la verdad.
 */
export function buildOrderReceipt(
  order: OrderForReceipt,
  extras: { email?: string | null } = {},
): Receipt {
  const shipping = (order.shippingAddress ?? null) as ShippingAddress | null;
  const history = order.history ?? [];
  return {
    kind: "online",
    id: order.id,
    code: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    ownerId: order.customerId,
    dates: {
      issued: order.createdAt,
      paid: order.paidAt ?? lastStatusAt(history, "confirmed"),
      ready: lastStatusAt(history, "ready"),
      shipped: lastStatusAt(history, "shipped"),
      delivered: lastStatusAt(history, "delivered"),
    },
    customer: {
      name:
        shipping?.fullName?.trim() ||
        order.customer?.fullName?.trim() ||
        "Cliente",
      phone: shipping?.phone?.trim() || order.customer?.phone || null,
      email: extras.email ?? null,
      city: shipping?.city?.trim() || null,
    },
    delivery: {
      type: shipping?.deliveryType ?? null,
      address: joinAddress(shipping),
      zone: shipping?.zone?.trim() || null,
      notes: shipping?.notes?.trim() || null,
      trackingCode: order.trackingCode,
    },
    lines: order.items.map((it) => ({
      name: it.productName,
      detail: it.variantLabel,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.lineTotal),
    })),
    totals: {
      subtotal: Number(order.subtotal),
      discount: Number(order.discountAmount ?? 0),
      shipping: Number(order.shippingCost ?? 0),
      total: Number(order.total),
    },
    cancelReason: order.cancelReason,
  };
}

export type ManualSaleForReceipt = typeof manualSales.$inferSelect & {
  items: (typeof manualSaleItems.$inferSelect)[];
};

export type ManualContact = {
  phone: string | null;
  email: string | null;
  city: string | null;
};

// Estados en los que la venta ya está cobrada (mismo criterio que reportes).
const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

/**
 * Comprobante de una venta MANUAL (mostrador / WhatsApp).
 *
 * - Con líneas (varias combinaciones o varios productos) cada una es un
 *   renglón. El `total` de la venta manda: si es mayor que la suma de las
 *   líneas (insumos cobrados aparte, ver `applyManualSaleLines`), la
 *   diferencia va como "Adicionales"; si es menor (total editado a mano), va
 *   como descuento. Así el comprobante siempre cierra en lo que se cobró.
 * - Sin líneas es la venta simple: un renglón con la cantidad y el precio
 *   unitario derivado (total ÷ cantidad); los colores salen del stock que
 *   descontó.
 */
export function buildManualSaleReceipt(
  sale: ManualSaleForReceipt,
  extras: { contact?: ManualContact | null; colors?: string[] } = {},
): Receipt {
  const total = Number(sale.total);
  const colors = extras.colors ?? [];
  const fallbackName =
    sale.detail?.trim() || sale.category?.trim() || "Producto";
  const units = Math.max(1, sale.quantity);

  const lines: ReceiptLine[] =
    sale.items.length > 0
      ? sale.items.map((it) => ({
          name: it.productName?.trim() || fallbackName,
          detail:
            [it.variantLabel?.trim(), it.color?.trim()]
              .filter(Boolean)
              .join(" · ") || null,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
        }))
      : [
          {
            name: fallbackName,
            detail: colors.length > 0 ? colors.join(" · ") : null,
            quantity: units,
            unitPrice: round2(total / units),
            lineTotal: total,
          },
        ];

  const linesSum = round2(lines.reduce((acc, l) => acc + l.lineTotal, 0));
  const adjust = round2(total - linesSum);
  if (adjust > 0) {
    lines.push({
      name: "Adicionales",
      detail: "Insumos y agregados cobrados aparte",
      quantity: 1,
      unitPrice: adjust,
      lineTotal: adjust,
    });
  }

  return {
    kind: "manual",
    id: sale.id,
    code: manualSaleCode(sale.id),
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    ownerId: null,
    dates: {
      issued: sale.saleDate,
      paid: REVENUE_STATUSES.includes(sale.status) ? sale.saleDate : null,
      ready: null,
      shipped: null,
      delivered: sale.status === "delivered" ? sale.saleDate : null,
    },
    customer: {
      name: sale.customerName.trim() || "Cliente",
      phone: extras.contact?.phone ?? null,
      email: extras.contact?.email ?? null,
      city: extras.contact?.city ?? null,
    },
    delivery: {
      type: null,
      address: null,
      zone: null,
      notes: null,
      trackingCode: null,
    },
    lines,
    totals: {
      subtotal: adjust > 0 ? total : linesSum,
      discount: adjust < 0 ? -adjust : 0,
      shipping: 0,
      total,
    },
    cancelReason: sale.cancelReason,
  };
}
