import { describe, expect, it } from "vitest";
import { buildMpItems, totalDeItems } from "./mpItems";

/**
 * Tests de PLATA. La regla que fijan es una sola y no se negocia:
 *
 *      lo que cobra MercadoPago === el total del pedido
 *
 * El 2026-08-03 no se cumplía: la preferencia se armaba solo con los productos,
 * así que un pedido de $48.400 (con $1.000 de envío) se cobraba $47.400. Un
 * peso de diferencia acá es plata que se pierde o que se le cobra de más a un
 * cliente.
 */

const base = {
  orderNumber: "HEF-TEST-0001",
  items: [
    { title: "T-REX", quantity: 1, unitPrice: 47400 },
    { title: "Mariposa", quantity: 2, unitPrice: 1900 },
  ],
  discountAmount: 0,
  shippingCost: 0,
};

describe("buildMpItems", () => {
  it("sin envío ni descuento: manda los productos tal cual", () => {
    const items = buildMpItems(base);
    expect(items).toHaveLength(2);
    expect(totalDeItems(items)).toBe(51200); // 47400 + 1900*2
  });

  it("con envío: lo agrega como línea aparte (el caso que perdía plata)", () => {
    const items = buildMpItems({ ...base, shippingCost: 1000 });
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({ title: "Envío", quantity: 1, unitPrice: 1000 });
    expect(totalDeItems(items)).toBe(52200);
  });

  it("con descuento: cobra el neto, no el precio de lista", () => {
    const items = buildMpItems({ ...base, discountAmount: 5000 });
    expect(totalDeItems(items)).toBe(46200); // 51200 - 5000
  });

  it("con descuento Y envío: cierra exacto", () => {
    const items = buildMpItems({
      ...base,
      discountAmount: 5000,
      shippingCost: 1000,
    });
    expect(totalDeItems(items)).toBe(47200); // 51200 - 5000 + 1000
  });

  it("el total de las líneas coincide con la fórmula del pedido", () => {
    // Misma cuenta que hace orderService: subtotal - descuento + envío.
    const casos = [
      { descuento: 0, envio: 0 },
      { descuento: 0, envio: 700 },
      { descuento: 1234.56, envio: 0 },
      { descuento: 1234.56, envio: 1500 },
      { descuento: 51200, envio: 1000 }, // descuento total
    ];
    for (const c of casos) {
      const subtotal = 51200;
      const esperado =
        Math.max(0, Math.round((subtotal - c.descuento) * 100) / 100) + c.envio;
      const items = buildMpItems({
        ...base,
        discountAmount: c.descuento,
        shippingCost: c.envio,
      });
      expect(totalDeItems(items)).toBeCloseTo(esperado, 2);
    }
  });

  it("un descuento mayor al subtotal nunca deja un precio negativo", () => {
    const items = buildMpItems({ ...base, discountAmount: 999999 });
    expect(items.every((i) => i.unitPrice >= 0)).toBe(true);
    expect(totalDeItems(items)).toBe(0);
  });

  it("envío en 0 no agrega la línea (retiro en el local)", () => {
    const items = buildMpItems({ ...base, shippingCost: 0 });
    expect(items.some((i) => i.title === "Envío")).toBe(false);
  });
});
