import { describe, expect, it, vi } from "vitest";
import {
  applyCappedDelta,
  computeNewStock,
  deleteFailure,
  filamentStatus,
  isLowStock,
  registerFailure,
  resolveFilamentForItem,
  resolveFilamentForManualSale,
  restoreStock,
  type DeleteFailureDeps,
  type RegisterFailureDeps,
} from "./service";
import { NotFoundError } from "@/core/errors";
import type { Filament, PrintFailure } from "./types";

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

// --- Ledger de ventas (diseño 2026-07): capping y matching (Cap. 15) ---

describe("applyCappedDelta", () => {
  it("aplica el delta completo cuando hay stock", () => {
    expect(applyCappedDelta(1000, -150)).toEqual({
      newStock: 850,
      appliedDelta: -150,
    });
  });
  it("nunca baja de 0 y devuelve el delta REAL aplicado", () => {
    // Pedía -80 con 50 en stock: queda 0 y el movimiento registra -50.
    expect(applyCappedDelta(50, -80)).toEqual({
      newStock: 0,
      appliedDelta: -50,
    });
  });
  it("con stock 0 el delta real es 0 (movimiento marcador)", () => {
    expect(applyCappedDelta(0, -100)).toEqual({ newStock: 0, appliedDelta: 0 });
  });
  it("las reposiciones suman tal cual", () => {
    expect(applyCappedDelta(100, 50)).toEqual({
      newStock: 150,
      appliedDelta: 50,
    });
  });
});

const stockFilaments = [
  { id: "f1", material: "PLA", color: "Negro" },
  { id: "f2", material: "PLA", color: "Rojo" },
  { id: "f3", material: "PETG", color: "Rojo" },
];

describe("resolveFilamentForItem (pedidos online)", () => {
  it("matchea material del producto + color del label", () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PLA",
        variantLabel: "Rojo",
      })?.id,
    ).toBe("f2");
  });

  it('con label compuesto "Talle · Color" usa el color (último segmento)', () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PLA",
        variantLabel: "20 cm · Rojo",
      })?.id,
    ).toBe("f2");
  });

  it("es insensible a mayúsculas y espacios", () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "pla",
        variantLabel: "  negro ",
      })?.id,
    ).toBe("f1");
  });

  it("el mismo color en otro material NO matchea (material manda)", () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PETG",
        variantLabel: "Negro",
      }),
    ).toBeNull();
  });

  it("sin material, sin label o sin filamento del color → null (warn, no bloquea)", () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: null,
        variantLabel: "Rojo",
      }),
    ).toBeNull();
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PLA",
        variantLabel: null,
      }),
    ).toBeNull();
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PLA",
        variantLabel: "Verde",
      }),
    ).toBeNull();
  });

  it("un label que es solo talle (sin color) no matchea", () => {
    expect(
      resolveFilamentForItem(stockFilaments, {
        material: "PLA",
        variantLabel: "Grande",
      }),
    ).toBeNull();
  });
});

describe("resolveFilamentForManualSale (ventas manuales)", () => {
  it("por id elegido, directo", () => {
    expect(
      resolveFilamentForManualSale(stockFilaments, { filamentId: "f3" })?.id,
    ).toBe("f3");
  });

  it("id inexistente → null (el filamento se borró)", () => {
    expect(
      resolveFilamentForManualSale(stockFilaments, { filamentId: "nope" }),
    ).toBeNull();
  });

  it("por material SOLO si hay un único filamento de ese material", () => {
    expect(
      resolveFilamentForManualSale(stockFilaments, { material: "petg" })?.id,
    ).toBe("f3");
  });

  it("material ambiguo (varios colores) → null: no se adivina", () => {
    expect(
      resolveFilamentForManualSale(stockFilaments, { material: "PLA" }),
    ).toBeNull();
  });

  it("sin id ni material → null", () => {
    expect(resolveFilamentForManualSale(stockFilaments, {})).toBeNull();
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

const printFailure = {
  id: "fail-1",
  filamentId: "f1",
  pieceName: "Dragón",
  material: "PLA",
  color: "Negro",
  gramsLost: "120.00",
  reason: "warping",
  notes: null,
  deducted: true,
  createdAt: new Date(),
} as unknown as PrintFailure;

function delDeps(f: PrintFailure | null, fil: Filament | null = filament) {
  const persist = vi.fn<DeleteFailureDeps["persist"]>(async () => {});
  return {
    persist,
    deps: {
      findFailure: async () => f,
      findFilamentById: async () => fil,
      persist,
    } as DeleteFailureDeps,
  };
}

describe("restoreStock", () => {
  it("suma los gramos devueltos al stock", () => {
    expect(restoreStock(1000, 120)).toBe(1120);
  });
});

describe("deleteFailure", () => {
  it("devuelve los gramos al stock cuando la falla los había descontado", async () => {
    const { deps: d, persist } = delDeps(printFailure);
    const res = await deleteFailure("fail-1", d);
    expect(persist.mock.calls[0]![0].stockUpdate).toEqual({
      filamentId: "f1",
      newStock: 1120, // 1000 + 120
    });
    expect(res.restored).toBe(120);
  });

  it("no toca el stock si la falla no había descontado (deducted false)", async () => {
    const { deps: d, persist } = delDeps({
      ...printFailure,
      deducted: false,
    } as PrintFailure);
    const res = await deleteFailure("fail-1", d);
    expect(persist.mock.calls[0]![0].stockUpdate).toBeUndefined();
    expect(res.restored).toBe(0);
  });

  it("no repone si el filamento ya no existe", async () => {
    const { deps: d, persist } = delDeps(printFailure, null);
    const res = await deleteFailure("fail-1", d);
    expect(persist.mock.calls[0]![0].stockUpdate).toBeUndefined();
    expect(res.restored).toBe(0);
  });

  it("lanza NotFound si la falla no existe y NO persiste", async () => {
    const { deps: d, persist } = delDeps(null);
    await expect(deleteFailure("x", d)).rejects.toBeInstanceOf(NotFoundError);
    expect(persist).not.toHaveBeenCalled();
  });
});
