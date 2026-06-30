import { describe, expect, it, vi } from "vitest";
import {
  computeNewStock,
  filamentStatus,
  isLowStock,
  registerFailure,
  type RegisterFailureDeps,
} from "./service";
import type { Filament } from "./types";

const filament = {
  id: "f1",
  material: "PLA",
  color: "Negro",
  stockGrams: "1000.00",
  alertThresholdGrams: "200.00",
} as unknown as Filament;

function deps(f: Filament | null = filament) {
  const persist = vi.fn<RegisterFailureDeps["persist"]>(async () => {});
  return {
    deps: { findFilament: async () => f, persist } as RegisterFailureDeps,
    persist,
  };
}

describe("computeNewStock", () => {
  it("descuenta los gramos", () => {
    expect(computeNewStock(1000, 150)).toBe(850);
  });
  it("nunca baja de 0", () => {
    expect(computeNewStock(100, 250)).toBe(0);
  });
});

describe("isLowStock", () => {
  it("marca bajo stock en o por debajo del umbral", () => {
    expect(isLowStock(200, 200)).toBe(true);
    expect(isLowStock(150, 200)).toBe(true);
    expect(isLowStock(201, 200)).toBe(false);
  });
});

describe("filamentStatus", () => {
  it("agotado cuando no hay stock", () => {
    expect(filamentStatus(0, 200)).toBe("agotado");
  });
  it("bajo cuando está en o bajo el umbral (pero > 0)", () => {
    expect(filamentStatus(200, 200)).toBe("bajo");
    expect(filamentStatus(150, 200)).toBe("bajo");
  });
  it("ok cuando supera el umbral", () => {
    expect(filamentStatus(201, 200)).toBe("ok");
  });
});

const baseParams = {
  pieceName: "Dragón",
  material: "PLA",
  color: "Negro",
  gramsLost: 150,
  reason: "warping",
  deducted: true,
};

describe("registerFailure", () => {
  it("descuenta del filamento que coincide cuando deducted", async () => {
    const { deps: d, persist } = deps();
    const res = await registerFailure(baseParams, d);
    const arg = persist.mock.calls[0]![0];
    expect(arg.stockUpdate).toEqual({ filamentId: "f1", newStock: 850 });
    expect(arg.failure.material).toBe("PLA");
    expect(arg.failure.filamentId).toBe("f1");
    expect(res.deducted).toBe(true);
  });

  it("avisa bajo stock si queda en o bajo el umbral", async () => {
    const { deps: d } = deps();
    const res = await registerFailure({ ...baseParams, gramsLost: 850 }, d);
    expect(res.lowStock).toBe(true); // 1000-850=150 <= 200
  });

  it("no descuenta si deducted es false", async () => {
    const { deps: d, persist } = deps();
    const res = await registerFailure({ ...baseParams, deducted: false }, d);
    expect(persist.mock.calls[0]![0].stockUpdate).toBeUndefined();
    expect(res.deducted).toBe(false);
  });

  it("registra sin descontar si no hay filamento que coincida", async () => {
    const { deps: d, persist } = deps(null);
    const res = await registerFailure(baseParams, d);
    const arg = persist.mock.calls[0]![0];
    expect(arg.stockUpdate).toBeUndefined();
    expect(arg.failure.filamentId).toBeNull();
    expect(arg.failure.deducted).toBe(false);
    expect(res.deducted).toBe(false);
  });
});
