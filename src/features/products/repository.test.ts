import { describe, it, expect } from "vitest";
import { mergeSalesCounts } from "./repository";

describe("mergeSalesCounts (ranking de 'Más vendidos': online + mostrador)", () => {
  it("suma cantidades del mismo producto en las dos listas", () => {
    const online = [{ productId: "p1", qty: 3 }];
    const manual = [{ productId: "p1", qty: 2 }];
    expect(mergeSalesCounts(online, manual).get("p1")).toBe(5);
  });

  it("productos que solo aparecen en una lista quedan igual", () => {
    const online = [{ productId: "p1", qty: 4 }];
    const manual = [{ productId: "p2", qty: 7 }];
    const merged = mergeSalesCounts(online, manual);
    expect(merged.get("p1")).toBe(4);
    expect(merged.get("p2")).toBe(7);
  });

  it("ignora filas sin productId (venta manual de texto libre, sin producto de catálogo)", () => {
    const manual = [
      { productId: null, qty: 10 },
      { productId: "p1", qty: 1 },
    ];
    const merged = mergeSalesCounts(manual);
    expect(merged.has("p1")).toBe(true);
    expect(merged.size).toBe(1);
  });

  it("ignora cantidades en cero o negativas", () => {
    const online = [
      { productId: "p1", qty: 0 },
      { productId: "p2", qty: -3 },
    ];
    expect(mergeSalesCounts(online).size).toBe(0);
  });

  it("sin listas o listas vacías → mapa vacío", () => {
    expect(mergeSalesCounts().size).toBe(0);
    expect(mergeSalesCounts([]).size).toBe(0);
  });

  it("suma más de dos listas a la vez", () => {
    const a = [{ productId: "p1", qty: 1 }];
    const b = [{ productId: "p1", qty: 1 }];
    const c = [{ productId: "p1", qty: 1 }];
    expect(mergeSalesCounts(a, b, c).get("p1")).toBe(3);
  });
});
