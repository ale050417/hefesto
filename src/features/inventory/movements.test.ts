import { describe, expect, it } from "vitest";
import { movementRef, toMovementView, type MovementRow } from "./movements";

const base: MovementRow = {
  id: "m1",
  filamentId: "f1",
  material: "PLA",
  color: "Rojo",
  deltaGrams: "-80.00",
  reason: "order",
  refId: "r1",
  createdAt: new Date("2026-10-30T15:00:00.000Z"),
  orderNumber: "HF-0042",
  saleCustomer: null,
  pieceName: null,
};

describe("toMovementView", () => {
  it("convierte el numeric a número con signo y la fecha a ISO", () => {
    const v = toMovementView(base);
    expect(v.deltaGrams).toBe(-80);
    expect(v.createdAt).toBe("2026-10-30T15:00:00.000Z");
    expect(v.reasonLabel).toBe("Pedido online");
    expect(v.ref).toBe("HF-0042");
  });

  it("un motivo desconocido se muestra tal cual", () => {
    expect(toMovementView({ ...base, reason: "algo_nuevo" }).reasonLabel).toBe(
      "algo_nuevo",
    );
  });
});

describe("movementRef", () => {
  it("venta manual → cliente", () => {
    expect(
      movementRef({
        ...base,
        reason: "manual_sale",
        orderNumber: null,
        saleCustomer: " Feria ",
      }),
    ).toBe("Feria");
  });

  it("falla → pieza", () => {
    expect(
      movementRef({
        ...base,
        reason: "failure",
        orderNumber: null,
        pieceName: "Lámpara",
      }),
    ).toBe("Lámpara");
  });

  it("reposición → el pedido o la venta que exista", () => {
    expect(movementRef({ ...base, reason: "restore" })).toBe("HF-0042");
    expect(
      movementRef({
        ...base,
        reason: "restore",
        orderNumber: null,
        saleCustomer: "Feria",
      }),
    ).toBe("Feria");
  });

  it("ajuste o origen borrado → null", () => {
    expect(movementRef({ ...base, reason: "adjust" })).toBeNull();
    expect(movementRef({ ...base, orderNumber: null })).toBeNull();
  });
});
