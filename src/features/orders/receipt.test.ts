import { describe, expect, it } from "vitest";
import {
  buildManualSaleReceipt,
  buildOrderReceipt,
  manualSaleCode,
  receiptPath,
  type ManualSaleForReceipt,
  type OrderForReceipt,
} from "./receipt";
import type { OrderStatus } from "./types";

const ID = "3f9a2c1b-7d4e-4a6b-9c8d-0e1f2a3b4c5d";
const d = (iso: string) => new Date(iso);

const HISTORY: Array<{ toStatus: OrderStatus; createdAt: Date }> = [
  { toStatus: "pending_payment", createdAt: d("2026-09-10T15:00:00Z") },
  { toStatus: "confirmed", createdAt: d("2026-09-10T15:05:00Z") },
  { toStatus: "in_production", createdAt: d("2026-09-11T12:00:00Z") },
  { toStatus: "ready", createdAt: d("2026-09-13T12:00:00Z") },
  { toStatus: "shipped", createdAt: d("2026-09-14T12:00:00Z") },
  { toStatus: "delivered", createdAt: d("2026-09-15T15:00:00Z") },
];

function pedido(over: Partial<OrderForReceipt> = {}): OrderForReceipt {
  return {
    id: ID,
    orderNumber: "HEF-0042",
    customerId: "user-1",
    status: "delivered",
    subtotal: "12000.00",
    discountAmount: "1000.00",
    couponId: null,
    shippingCost: "1500.00",
    total: "12500.00",
    paymentMethod: "mercadopago",
    shippingAddress: {
      fullName: "Nicolás Gómez",
      phone: "3757 123456",
      street: "Av. Victoria Aguirre 320",
      city: "Puerto Iguazú",
      province: "Misiones",
      postalCode: "3370",
      zone: "Centro",
      deliveryType: "local",
      notes: "Tocar timbre",
    },
    trackingCode: null,
    internalNote: "nota interna que NO va al cliente",
    cancelReason: null,
    createdAt: d("2026-09-10T15:00:00Z"),
    updatedAt: d("2026-09-15T15:00:00Z"),
    paidAt: d("2026-09-10T15:05:00Z"),
    items: [
      {
        id: "i1",
        orderId: ID,
        productId: null,
        productName: "Llavero Boca",
        variantLabel: "Chico · Azul + Amarillo",
        unitPrice: "4000.00",
        quantity: 3,
        lineTotal: "12000.00",
      },
    ],
    history: HISTORY.map((h, i) => ({
      id: `h${i}`,
      orderId: ID,
      fromStatus: null,
      changedBy: null,
      note: null,
      ...h,
    })),
    customer: { fullName: "Nico G.", phone: "11 0000-0000" },
    ...over,
  };
}

function venta(over: Partial<ManualSaleForReceipt> = {}): ManualSaleForReceipt {
  return {
    id: ID,
    saleDate: d("2026-09-20T15:00:00Z"),
    customerName: "María López",
    detail: "Dumpling",
    cancelReason: null,
    category: "Decoración",
    productId: null,
    quantity: 3,
    total: "9000.00",
    amortization: null,
    profit: null,
    paymentMethod: "cash",
    status: "delivered",
    profitSplit: null,
    filamentId: null,
    grams: null,
    colorLines: null,
    createdBy: null,
    createdAt: d("2026-09-20T15:00:00Z"),
    items: [],
    ...over,
  };
}

describe("receiptPath / manualSaleCode", () => {
  it("arma la URL por tipo de venta", () => {
    expect(receiptPath("online", ID)).toBe(`/comprobante/pedido/${ID}`);
    expect(receiptPath("manual", ID)).toBe(`/comprobante/venta/${ID}`);
  });

  it("el número de una venta manual sale del id, corto y en mayúsculas", () => {
    expect(manualSaleCode(ID)).toBe("VM-3F9A2C1B");
  });
});

describe("buildOrderReceipt (pedido online)", () => {
  it("usa el número del pedido y los totales del registro", () => {
    const r = buildOrderReceipt(pedido(), { email: "nico@mail.com" });
    expect(r.kind).toBe("online");
    expect(r.code).toBe("HEF-0042");
    expect(r.ownerId).toBe("user-1");
    expect(r.totals).toEqual({
      subtotal: 12000,
      discount: 1000,
      shipping: 1500,
      total: 12500,
    });
    expect(r.lines).toEqual([
      {
        name: "Llavero Boca",
        detail: "Chico · Azul + Amarillo",
        quantity: 3,
        unitPrice: 4000,
        lineTotal: 12000,
      },
    ]);
  });

  it("el cliente sale de la entrega (lo que escribió al comprar) y el mail de auth", () => {
    const r = buildOrderReceipt(pedido(), { email: "nico@mail.com" });
    expect(r.customer).toEqual({
      name: "Nicolás Gómez",
      phone: "3757 123456",
      email: "nico@mail.com",
      city: "Puerto Iguazú",
    });
    expect(r.delivery.type).toBe("local");
    expect(r.delivery.zone).toBe("Centro");
    expect(r.delivery.address).toBe(
      "Av. Victoria Aguirre 320, Puerto Iguazú, Misiones (CP 3370)",
    );
    expect(r.delivery.notes).toBe("Tocar timbre");
  });

  it("sin entrega cargada cae al perfil y no inventa dirección", () => {
    const r = buildOrderReceipt(pedido({ shippingAddress: null }));
    expect(r.customer.name).toBe("Nico G.");
    expect(r.customer.phone).toBe("11 0000-0000");
    expect(r.customer.email).toBeNull();
    expect(r.delivery.address).toBeNull();
    expect(r.delivery.type).toBeNull();
  });

  it("las fechas de cuándo salió vienen del historial", () => {
    const r = buildOrderReceipt(pedido());
    expect(r.dates.issued).toEqual(d("2026-09-10T15:00:00Z"));
    expect(r.dates.paid).toEqual(d("2026-09-10T15:05:00Z"));
    expect(r.dates.ready).toEqual(d("2026-09-13T12:00:00Z"));
    expect(r.dates.shipped).toEqual(d("2026-09-14T12:00:00Z"));
    expect(r.dates.delivered).toEqual(d("2026-09-15T15:00:00Z"));
  });

  it("sin paidAt usa la fecha en que pasó a confirmado; sin envío queda null", () => {
    const r = buildOrderReceipt(
      pedido({
        paidAt: null,
        status: "in_production",
        history: pedido().history.slice(0, 3),
      }),
    );
    expect(r.dates.paid).toEqual(d("2026-09-10T15:05:00Z"));
    expect(r.dates.shipped).toBeNull();
    expect(r.dates.delivered).toBeNull();
  });

  it("la nota interna del taller NO viaja al comprobante", () => {
    const r = buildOrderReceipt(pedido());
    expect(JSON.stringify(r)).not.toContain("nota interna");
  });
});

describe("buildManualSaleReceipt (venta manual)", () => {
  it("venta simple: un renglón con precio unitario = total ÷ cantidad", () => {
    const r = buildManualSaleReceipt(venta(), { colors: ["Rojo", "Negro"] });
    expect(r.kind).toBe("manual");
    expect(r.code).toBe("VM-3F9A2C1B");
    expect(r.ownerId).toBeNull();
    expect(r.lines).toEqual([
      {
        name: "Dumpling",
        detail: "Rojo · Negro",
        quantity: 3,
        unitPrice: 3000,
        lineTotal: 9000,
      },
    ]);
    expect(r.totals).toEqual({
      subtotal: 9000,
      discount: 0,
      shipping: 0,
      total: 9000,
    });
  });

  it("con líneas, cada combinación es un renglón y el total cierra con la suma", () => {
    const r = buildManualSaleReceipt(
      venta({
        total: "7000.00",
        items: [
          linea({ variantLabel: "Rojo + Negro", quantity: 2, unitPrice: 2000 }),
          linea({
            productName: "Llavero",
            color: "Azul",
            quantity: 1,
            unitPrice: 3000,
          }),
        ],
      }),
    );
    expect(r.lines.map((l) => [l.name, l.detail, l.lineTotal])).toEqual([
      ["Dumpling", "Rojo + Negro", 4000],
      ["Llavero", "Azul", 3000],
    ]);
    expect(r.totals.subtotal).toBe(7000);
    expect(r.totals.total).toBe(7000);
  });

  it("si el total supera la suma de las líneas (insumos cobrados aparte) agrega Adicionales", () => {
    const r = buildManualSaleReceipt(
      venta({
        total: "4500.00",
        items: [linea({ quantity: 2, unitPrice: 2000 })],
      }),
    );
    expect(r.lines.at(-1)).toMatchObject({
      name: "Adicionales",
      lineTotal: 500,
    });
    expect(r.totals).toEqual({
      subtotal: 4500,
      discount: 0,
      shipping: 0,
      total: 4500,
    });
  });

  it("si el total quedó por debajo de las líneas (editado a mano) lo muestra como descuento", () => {
    const r = buildManualSaleReceipt(
      venta({
        total: "3500.00",
        items: [linea({ quantity: 2, unitPrice: 2000 })],
      }),
    );
    expect(r.lines).toHaveLength(1);
    expect(r.totals).toEqual({
      subtotal: 4000,
      discount: 500,
      shipping: 0,
      total: 3500,
    });
  });

  it("el contacto encontrado por nombre completa teléfono, mail y ciudad", () => {
    const r = buildManualSaleReceipt(venta(), {
      contact: { phone: "3757 555", email: "maria@mail.com", city: "Iguazú" },
    });
    expect(r.customer).toEqual({
      name: "María López",
      phone: "3757 555",
      email: "maria@mail.com",
      city: "Iguazú",
    });
  });

  it("entregada: la fecha de venta es la de pago y entrega; pendiente: ninguna", () => {
    const ok = buildManualSaleReceipt(venta());
    expect(ok.dates.paid).toEqual(d("2026-09-20T15:00:00Z"));
    expect(ok.dates.delivered).toEqual(d("2026-09-20T15:00:00Z"));
    const pend = buildManualSaleReceipt(venta({ status: "pending_payment" }));
    expect(pend.dates.paid).toBeNull();
    expect(pend.dates.delivered).toBeNull();
  });
});

type Linea = ManualSaleForReceipt["items"][number];

/** Línea de venta manual con precio en número (la base lo guarda como texto). */
function linea(
  over: Omit<Partial<Linea>, "quantity" | "unitPrice" | "lineTotal"> & {
    quantity: number;
    unitPrice: number;
  },
): Linea {
  const { quantity, unitPrice, ...rest } = over;
  return {
    id: `l-${Math.random()}`,
    manualSaleId: ID,
    productId: null,
    productName: null,
    variantLabel: null,
    color: null,
    quantity,
    unitPrice: unitPrice.toFixed(2),
    lineTotal: (unitPrice * quantity).toFixed(2),
    colorLines: null,
    ...rest,
  };
}
