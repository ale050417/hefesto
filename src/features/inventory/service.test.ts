import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/core/errors";
import {
  computeNewStock,
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
    deps: { getFilament: async () => f, persist } as RegisterFailureDeps,
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

describe("registerFailure", () => {
  it("descuenta del filamento cuando deducted", async () => {
    const { deps: d, persist } = deps();
    await registerFailure(
      {
        filamentId: "f1",
        pieceName: "Dragón",
        gramsLost: 150,
        reason: "warping",
        deducted: true,
      },
      d,
    );
    const arg = persist.mock.calls[0]![0];
    expect(arg.stockUpdate).toEqual({ filamentId: "f1", newStock: 850 });
    expect(arg.failure.material).toBe("PLA");
  });

  it("avisa bajo stock si queda en o bajo el umbral", async () => {
    const { deps: d } = deps();
    const res = await registerFailure(
      {
        filamentId: "f1",
        pieceName: "X",
        gramsLost: 850,
        reason: "y",
        deducted: true,
      },
      d,
    );
    expect(res.lowStock).toBe(true); // 1000-850=150 <= 200
  });

  it("no descuenta si deducted es false", async () => {
    const { deps: d, persist } = deps();
    await registerFailure(
      {
        filamentId: "f1",
        pieceName: "X",
        gramsLost: 50,
        reason: "y",
        deducted: false,
      },
      d,
    );
    expect(persist.mock.calls[0]![0].stockUpdate).toBeUndefined();
  });

  it("lanza NotFound si el filamento no existe", async () => {
    const { deps: d } = deps(null);
    await expect(
      registerFailure(
        {
          filamentId: "x",
          pieceName: "X",
          gramsLost: 1,
          reason: "y",
          deducted: true,
        },
        d,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
