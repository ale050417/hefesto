import { describe, expect, it } from "vitest";
import {
  buildFailuresView,
  failureCostPerKg,
  type FailureInputRow,
} from "./failures-view";

const filaments = [
  { material: "PLA", color: "Rojo", costPerKg: 20000 },
  { material: "PETG", color: "Rojo", costPerKg: 30000 },
  { material: "PLA", color: "Negro", costPerKg: 18000 },
];

const row = (over: Partial<FailureInputRow>): FailureInputRow => ({
  id: "a",
  createdAt: new Date("2026-10-30T10:00:00.000Z"),
  pieceName: "Lámpara",
  material: "PLA",
  color: "Rojo",
  gramsLost: "150.00",
  reason: "Boquilla tapada",
  notes: null,
  deducted: true,
  ...over,
});

describe("failureCostPerKg", () => {
  it("prefiere material + color", () => {
    expect(failureCostPerKg(filaments, "PETG", "Rojo")).toBe(30000);
  });
  it("si el material no coincide usa el primero con ese color", () => {
    expect(failureCostPerKg(filaments, "ABS", "Negro")).toBe(18000);
  });
  it("sin carrete → 0", () => {
    expect(failureCostPerKg(filaments, "PLA", "Verde")).toBe(0);
    expect(failureCostPerKg(filaments, null, null)).toBe(0);
  });
});

describe("buildFailuresView", () => {
  it("calcula costo = gramos / 1000 × costo por kg", () => {
    const { items } = buildFailuresView([row({})], filaments);
    expect(items[0]!.cost).toBeCloseTo(3000);
    expect(items[0]!.gramsLost).toBe(150);
    expect(items[0]!.createdAt).toBe("2026-10-30T10:00:00.000Z");
  });

  it("resume cantidad, gramos, costo y causa más común", () => {
    const { summary } = buildFailuresView(
      [
        row({ id: "1" }),
        row({ id: "2", gramsLost: "50.00", reason: "Corte de luz" }),
        row({ id: "3", gramsLost: "100", reason: "Boquilla tapada" }),
      ],
      filaments,
    );
    expect(summary.count).toBe(3);
    expect(summary.totalGrams).toBe(300);
    expect(summary.totalCost).toBeCloseTo(6000);
    expect(summary.topReason).toBe("Boquilla tapada");
    expect(summary.topReasonCount).toBe(2);
  });

  it("sin fallas: resumen en cero y sin causa", () => {
    expect(buildFailuresView([], filaments).summary).toEqual({
      count: 0,
      totalGrams: 0,
      totalCost: 0,
      topReason: null,
      topReasonCount: 0,
    });
  });

  it("material/color nulos (fallas viejas) no rompen", () => {
    const { items } = buildFailuresView(
      [row({ material: null, color: null })],
      filaments,
    );
    expect(items[0]!.material).toBe("");
    expect(items[0]!.color).toBe("");
    expect(items[0]!.cost).toBe(0);
  });
});
