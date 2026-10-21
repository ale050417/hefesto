import { describe, expect, it } from "vitest";
import type { Receipt, ReceiptBusiness } from "../receipt";
import { renderReceiptPdf } from "./receipt-pdf";

const d = (iso: string) => new Date(iso);

const business: ReceiptBusiness = {
  name: "Hefesto 3D",
  slogan: "Forjado en capas",
  logoUrl: null,
  whatsapp: "+54 9 3757 51-2345",
  email: "hola@hefesto3d.com",
  instagram: "hefesto3d",
  address: "Av. Victoria Aguirre 320, Puerto Iguazú",
  cuit: null,
  site: "hefesto3d.com",
  accent: null,
};

const receipt: Receipt = {
  kind: "online",
  id: "3f9a2c1b-7d4e-4a6b-9c8d-0e1f2a3b4c5d",
  code: "HEF-0042",
  status: "delivered",
  paymentMethod: "mercadopago",
  ownerId: "u1",
  dates: {
    issued: d("2026-09-10T15:00:00Z"),
    paid: d("2026-09-10T15:05:00Z"),
    ready: d("2026-09-13T12:00:00Z"),
    shipped: d("2026-09-14T12:00:00Z"),
    delivered: d("2026-09-15T15:00:00Z"),
  },
  customer: {
    name: "Nicolás Gómez",
    phone: "3757 123456",
    email: "nico@mail.com",
    city: "Puerto Iguazú",
  },
  delivery: {
    type: "local",
    address: "Av. Victoria Aguirre 320, Puerto Iguazú, Misiones (CP 3370)",
    zone: "Centro",
    notes: "Tocar timbre",
    trackingCode: null,
  },
  lines: [
    {
      name: "Llavero Boca",
      detail: "Chico · Azul + Amarillo",
      quantity: 3,
      unitPrice: 4000,
      lineTotal: 12000,
    },
    {
      name: "Porta sahumerios Luna",
      detail: "Negro",
      quantity: 1,
      unitPrice: 6500,
      lineTotal: 6500,
    },
  ],
  totals: { subtotal: 18500, discount: 1850, shipping: 1500, total: 18150 },
  cancelReason: null,
};

describe("renderReceiptPdf", () => {
  it("genera un PDF válido con las fuentes de la marca (sin logo: marca dibujada)", async () => {
    const pdf = await renderReceiptPdf(receipt, business);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Con las fuentes embebidas el archivo pesa bastante más que un PDF vacío.
    expect(pdf.length).toBeGreaterThan(20_000);
  }, 30_000);

  it("una venta manual con varias líneas y descuento también sale", async () => {
    const manual: Receipt = {
      ...receipt,
      kind: "manual",
      code: "VM-3F9A2C1B",
      ownerId: null,
      paymentMethod: "cash",
      delivery: {
        type: null,
        address: null,
        zone: null,
        notes: null,
        trackingCode: null,
      },
      lines: Array.from({ length: 30 }, (_, i) => ({
        name: `Dumpling ${i + 1}`,
        detail: "Rojo + Negro",
        quantity: 1,
        unitPrice: 2000,
        lineTotal: 2000,
      })),
      totals: { subtotal: 60000, discount: 500, shipping: 0, total: 59500 },
    };
    const pdf = await renderReceiptPdf(manual, business);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
