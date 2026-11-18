import { describe, expect, it } from "vitest";
import { isOpenStatus, monthKeyOf, monthLabel, stepMonth } from "./sale-month";

describe("monthKeyOf (mes de una venta en hora de Argentina)", () => {
  it("una venta del 31 a las 22:30 de Argentina sigue siendo de ese mes", () => {
    // 22:30 del 31/10 en Argentina (UTC-3) = 01:30 del 1/11 en UTC.
    expect(monthKeyOf("2026-11-01T01:30:00.000Z")).toBe("2026-10");
    expect(monthKeyOf(new Date("2026-11-01T01:30:00.000Z"))).toBe("2026-10");
  });

  it("pasadas las 00:00 de Argentina ya es el mes nuevo", () => {
    expect(monthKeyOf("2026-11-01T02:59:59.000Z")).toBe("2026-10");
    expect(monthKeyOf("2026-11-01T03:00:00.000Z")).toBe("2026-11");
  });

  it("el borde de fin de año cae en el año correcto", () => {
    // 23:00 del 31/12/2026 en Argentina = 02:00 del 1/1/2027 en UTC.
    expect(monthKeyOf("2027-01-01T02:00:00.000Z")).toBe("2026-12");
    expect(monthKeyOf("2027-01-01T03:00:00.000Z")).toBe("2027-01");
  });

  it("la venta manual (guardada al mediodía) cae en su día", () => {
    expect(monthKeyOf("2026-11-30T15:00:00.000Z")).toBe("2026-11");
  });

  it("fecha ilegible → null", () => {
    expect(monthKeyOf("no es una fecha")).toBeNull();
  });
});

describe("stepMonth", () => {
  it("avanza y retrocede dentro del año", () => {
    expect(stepMonth("2026-11", -1)).toBe("2026-10");
    expect(stepMonth("2026-11", 1)).toBe("2026-12");
  });

  it("cruza de año en las dos direcciones", () => {
    expect(stepMonth("2026-12", 1)).toBe("2027-01");
    expect(stepMonth("2026-01", -1)).toBe("2025-12");
    expect(stepMonth("2026-11", -12)).toBe("2025-11");
    expect(stepMonth("2026-11", 14)).toBe("2028-01");
  });

  it("las claves se ordenan como texto", () => {
    expect("2025-12" < "2026-01").toBe(true);
    expect("2026-09" < "2026-10").toBe(true);
  });
});

describe("monthLabel", () => {
  it("muestra mes y año", () => {
    expect(monthLabel("2026-11")).toBe("noviembre 2026");
    expect(monthLabel("2027-01")).toBe("enero 2027");
  });
});

describe("isOpenStatus", () => {
  it("entregado, cancelado y reembolsado están cerrados; el resto, abierto", () => {
    expect(isOpenStatus("delivered")).toBe(false);
    expect(isOpenStatus("cancelled")).toBe(false);
    expect(isOpenStatus("refunded")).toBe(false);
    expect(isOpenStatus("pending_payment")).toBe(true);
    expect(isOpenStatus("in_production")).toBe(true);
    expect(isOpenStatus("shipped")).toBe(true);
  });
});
