import { describe, expect, it } from "vitest";
import type { Receipt } from "./receipt";
import {
  cancelLabel,
  deliveryTitle,
  milestones,
  paidLabel,
} from "./receipt-format";

const d = (iso: string) => new Date(iso);

const base: Receipt = {
  kind: "online",
  id: "3f9a2c1b-7d4e-4a6b-9c8d-0e1f2a3b4c5d",
  code: "HEF-0042",
  status: "delivered",
  paymentMethod: "mercadopago",
  ownerId: "u1",
  dates: {
    issued: d("2026-09-10T15:00:00Z"),
    paid: d("2026-09-10T15:05:00Z"),
    ready: null,
    shipped: d("2026-09-14T12:00:00Z"),
    delivered: d("2026-09-15T15:00:00Z"),
  },
  customer: { name: "Nicolás", phone: null, email: null, city: null },
  delivery: {
    type: "local",
    address: "Calle 1",
    zone: "Centro",
    notes: null,
    trackingCode: null,
  },
  lines: [],
  totals: { subtotal: 0, discount: 0, shipping: 0, total: 0 },
  cancelReason: null,
};

describe("milestones (fechas del comprobante)", () => {
  it("pedido online: cada hito con su hora, en hora argentina", () => {
    expect(milestones(base)).toEqual([
      { label: "Pedido", value: "10/09/2026, 12:00" },
      { label: "Pago", value: "10/09/2026, 12:05" },
      { label: "Enviado", value: "14/09/2026, 09:00" },
      { label: "Entregado", value: "15/09/2026, 12:00" },
    ]);
  });

  it("retiro en el taller dice Retirado; pago pendiente lo dice", () => {
    const r: Receipt = {
      ...base,
      status: "pending_payment",
      dates: { ...base.dates, paid: null, shipped: null, delivered: null },
      delivery: { ...base.delivery, type: "pickup" },
    };
    expect(milestones(r)).toEqual([
      { label: "Pedido", value: "10/09/2026, 12:00" },
      { label: "Pago", value: "Pendiente" },
    ]);
    expect(paidLabel(r)).toBe("Pago pendiente");
    expect(deliveryTitle(r)).toBe("Retiro en el taller");
    const retirado: Receipt = {
      ...r,
      status: "delivered",
      dates: { ...r.dates, delivered: d("2026-09-12T15:00:00Z") },
    };
    expect(milestones(retirado).at(-1)).toEqual({
      label: "Retirado",
      value: "12/09/2026, 12:00",
    });
  });

  it("venta manual: solo el día (la hora guardada es sintética) y sin repetir", () => {
    const when = d("2026-10-19T12:00:00Z");
    const r: Receipt = {
      ...base,
      kind: "manual",
      code: "VM-3F9A2C1B",
      ownerId: null,
      dates: {
        issued: when,
        paid: when,
        ready: null,
        shipped: null,
        delivered: when,
      },
      delivery: {
        type: null,
        address: null,
        zone: null,
        notes: null,
        trackingCode: null,
      },
    };
    expect(milestones(r)).toEqual([{ label: "Venta", value: "19/10/2026" }]);
    expect(paidLabel(r)).toBe("Pagado el 19/10/2026");
  });
});

describe("cancelLabel", () => {
  it("solo con estado cancelado/reembolsado y motivo cargado", () => {
    expect(cancelLabel(base)).toBeNull();
    expect(
      cancelLabel({ ...base, status: "refunded", cancelReason: "Falla" }),
    ).toBe("Motivo de reembolso: Falla");
    expect(cancelLabel({ ...base, status: "cancelled" })).toBeNull();
  });
});
