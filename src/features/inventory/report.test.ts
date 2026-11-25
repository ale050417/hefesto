import { describe, expect, it } from "vitest";
import { buildFilamentReport } from "./report";
import type { FilamentView } from "./types";

const base = (over: Partial<FilamentView>): FilamentView => ({
  id: "f",
  material: "PLA",
  color: "Negro",
  brand: "Grilon3",
  diameter: "1.75",
  stockGrams: 1000,
  spoolGrams: 1000,
  costPerKg: 10000,
  typeId: null,
  spoolModelId: null,
  alertThresholdGrams: 200,
  lowStock: false,
  status: "ok",
  ...over,
});

// Mes 0-based: 9 = octubre.
const now = new Date(2026, 9, 30);

describe("buildFilamentReport", () => {
  it("arma resumen, qué reponer y el stock de cada color por material", () => {
    const text = buildFilamentReport(
      [
        base({ id: "1", color: "Negro", stockGrams: 1500 }),
        base({
          id: "2",
          color: "Rojo",
          brand: "eSun",
          stockGrams: 120,
          status: "bajo",
          lowStock: true,
        }),
        base({
          id: "3",
          material: "PETG",
          color: "Azul",
          stockGrams: 0,
          status: "agotado",
          lowStock: true,
          costPerKg: 12000,
        }),
      ],
      now,
    );

    expect(text).toContain("Fecha: 30/10/2026");
    expect(text).toContain("• Total en stock: 1.62 kg");
    expect(text).toMatch(/Valor estimado: \$\s?16\.200/);
    expect(text).toContain("• Colores: 3 (en stock 1, bajo 1, agotado 1)");
    expect(text).toContain("• PLA Rojo · eSun: 120 g (stock bajo)");
    expect(text).toContain("• PETG Azul · Grilon3: agotado");
    expect(text).toContain("PLA: 1.62 kg (2 colores)");
    expect(text).toContain("• Negro · Grilon3: 1.50 kg");
  });

  it("pone los agotados antes que los de stock bajo", () => {
    const text = buildFilamentReport(
      [
        base({ color: "Rojo", stockGrams: 120, status: "bajo" }),
        base({ color: "Azul", stockGrams: 0, status: "agotado" }),
      ],
      now,
    );
    expect(text.indexOf("• PLA Azul")).toBeLessThan(text.indexOf("• PLA Rojo"));
  });

  it("sin nada para reponer lo dice, y un stock negativo cuenta como 0", () => {
    const text = buildFilamentReport(
      [base({ stockGrams: -50, status: "agotado" })],
      now,
    );
    expect(text).toContain("• Total en stock: 0 g");
    expect(text).toContain("• PLA Negro · Grilon3: agotado");

    const ok = buildFilamentReport([base({})], now);
    expect(ok).toContain("• Nada por ahora ✅");
  });

  it("sin filamentos cargados no arma el resumen", () => {
    const text = buildFilamentReport([], now);
    expect(text).toContain("No hay filamentos cargados.");
    expect(text).not.toContain("RESUMEN");
  });
});
