import { describe, expect, it, vi } from "vitest";
import { resolveFilamentForItem } from "@/features/inventory/service";
import type { Filament, NewFilamentMovement } from "@/features/inventory/types";
import type { OrderWithItems } from "../types";
import {
  deductFilamentForOrder,
  restoreFilamentForOrder,
  type OrderInventoryDeps,
} from "./orderInventory";

// Toca stock → tests en el mismo paso (Cap. 15). Dobles puros, sin DB.

const filaments = [
  { id: "f1", material: "PLA", color: "Negro", stockGrams: "1000.00" },
  { id: "f2", material: "PLA", color: "Rojo", stockGrams: "500.00" },
] as unknown as Filament[];

function makeOrder(items: Array<Partial<OrderWithItems["items"][number]>>) {
  return {
    id: "o1",
    items: items.map((it, i) => ({
      id: `i${i}`,
      orderId: "o1",
      productId: "p1",
      productName: "Dragón",
      variantLabel: "Rojo",
      unitPrice: "1000.00",
      quantity: 1,
      lineTotal: "1000.00",
      ...it,
    })),
  } as unknown as OrderWithItems;
}

function makeDeps(overrides: Partial<OrderInventoryDeps> = {}) {
  const applyDeltas = vi.fn<OrderInventoryDeps["applyDeltas"]>(async () => []);
  const audit = vi.fn(async () => undefined);
  const deps: OrderInventoryDeps = {
    getOrder: async () => makeOrder([{}]),
    getProductSpecs: async () => ({
      material: "PLA",
      weightGrams: 120,
      colorMode: "single" as const,
      colors: [],
      colorGrams: {},
    }),
    listFilaments: async () => filaments,
    hasMovements: async () => false,
    applyDeltas,
    restoreByRef: async () => 0,
    resolveFilament: resolveFilamentForItem,
    audit: audit as unknown as OrderInventoryDeps["audit"],
    ...overrides,
  };
  return { deps, applyDeltas, audit };
}

describe("deductFilamentForOrder", () => {
  it("avisa (notifyLowStock) cuando la venta deja stock en/bajo el umbral", async () => {
    const low = [
      {
        filamentId: "f1",
        material: "PLA",
        color: "Rojo",
        stockGrams: 10,
        threshold: 50,
      },
    ];
    const notifyLowStock = vi.fn(async () => undefined);
    const { deps } = makeDeps({ applyDeltas: async () => low, notifyLowStock });
    await deductFilamentForOrder("o1", deps);
    expect(notifyLowStock).toHaveBeenCalledWith(low);
  });

  it("descuenta peso × cantidad del filamento por material + color", async () => {
    const { deps, applyDeltas } = makeDeps({
      getOrder: async () => makeOrder([{ variantLabel: "Rojo", quantity: 3 }]),
    });
    const res = await deductFilamentForOrder("o1", deps);

    expect(res.deducted).toBe(1);
    const movements = applyDeltas.mock.calls[0]![0] as NewFilamentMovement[];
    expect(movements).toEqual([
      {
        filamentId: "f2",
        material: "PLA",
        color: "Rojo",
        deltaGrams: -360, // 120 g × 3
        reason: "order",
        refId: "o1",
      },
    ]);
  });

  it("multicolor: descuenta los gramos de CADA color (colorGrams), no el peso total", async () => {
    const { deps, applyDeltas } = makeDeps({
      getOrder: async () =>
        makeOrder([{ variantLabel: "Negro + Rojo", quantity: 2 }]),
      getProductSpecs: async () => ({
        material: "PLA",
        weightGrams: 200,
        colorMode: "multi" as const,
        colors: ["Negro", "Rojo"],
        colorGrams: { Negro: 30, Rojo: 20 },
      }),
    });
    const res = await deductFilamentForOrder("o1", deps);

    expect(res.deducted).toBe(2); // un movimiento por color
    const movements = applyDeltas.mock.calls[0]![0] as NewFilamentMovement[];
    expect(movements).toEqual([
      {
        filamentId: "f1",
        material: "PLA",
        color: "Negro",
        deltaGrams: -60, // 30 g × 2
        reason: "order",
        refId: "o1",
      },
      {
        filamentId: "f2",
        material: "PLA",
        color: "Rojo",
        deltaGrams: -40, // 20 g × 2
        reason: "order",
        refId: "o1",
      },
    ]);
  });

  it("es idempotente: si el ledger ya tiene movimientos del pedido, no repite", async () => {
    const { deps, applyDeltas } = makeDeps({ hasMovements: async () => true });
    const res = await deductFilamentForOrder("o1", deps);
    expect(res.deducted).toBe(0);
    expect(applyDeltas).not.toHaveBeenCalled();
  });

  it("línea sin match NO bloquea: descuenta las que puede y audita el resto", async () => {
    const { deps, applyDeltas, audit } = makeDeps({
      getOrder: async () =>
        makeOrder([
          { variantLabel: "Rojo" }, // matchea f2
          { variantLabel: "Verde" }, // no hay filamento verde
        ]),
    });
    const res = await deductFilamentForOrder("o1", deps);

    expect(res.deducted).toBe(1);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0]!.reason).toContain("sin filamento");
    expect(applyDeltas).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "inventory.order_deduct_partial" }),
    );
  });

  it("producto sin peso o sin material → se saltea con warning", async () => {
    const { deps, applyDeltas, audit } = makeDeps({
      getProductSpecs: async () => ({
        material: "PLA",
        weightGrams: null,
        colorMode: "single" as const,
        colors: [],
        colorGrams: {},
      }),
    });
    const res = await deductFilamentForOrder("o1", deps);
    expect(res.deducted).toBe(0);
    expect(res.skipped[0]!.reason).toContain("sin peso");
    expect(applyDeltas).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });

  it("NUNCA lanza: un error de DB queda en auditoría y la venta sigue", async () => {
    const { deps, audit } = makeDeps({
      applyDeltas: vi.fn(async () => {
        throw new Error("DB caída");
      }),
    });
    await expect(deductFilamentForOrder("o1", deps)).resolves.toBeDefined();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "inventory.order_deduct_failed" }),
    );
  });
});

describe("restoreFilamentForOrder", () => {
  it("repone vía ledger (reason 'order' + ref del pedido)", async () => {
    const restoreByRef = vi.fn<OrderInventoryDeps["restoreByRef"]>(
      async () => 360,
    );
    const { deps } = makeDeps({ restoreByRef });
    const grams = await restoreFilamentForOrder("o1", deps);
    expect(grams).toBe(360);
    expect(restoreByRef).toHaveBeenCalledWith("order", "o1");
  });

  it("NUNCA lanza: el error queda auditado y devuelve 0", async () => {
    const { deps, audit } = makeDeps({
      restoreByRef: vi.fn(async () => {
        throw new Error("DB caída");
      }),
    });
    await expect(restoreFilamentForOrder("o1", deps)).resolves.toBe(0);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "inventory.order_restore_failed" }),
    );
  });
});

// Reversa completa deduct → restore (diseño 2026-07): lo que se descontó es
// exactamente lo que se repone, vía ledger simulado.
describe("reversa completa (deduct → restore)", () => {
  it("los gramos repuestos igualan a los descontados", async () => {
    const ledger: NewFilamentMovement[] = [];
    const { deps } = makeDeps({
      getOrder: async () => makeOrder([{ variantLabel: "Rojo", quantity: 2 }]),
      hasMovements: async () => ledger.length > 0,
      applyDeltas: async (movs) => {
        ledger.push(...movs);
        return [];
      },
      restoreByRef: async (_reason, refId) =>
        ledger
          .filter((m) => m.refId === refId && m.deltaGrams < 0)
          .reduce((acc, m) => acc - m.deltaGrams, 0),
    });

    await deductFilamentForOrder("o1", deps);
    expect(ledger[0]!.deltaGrams).toBe(-240);

    // Reintento del hook: idempotente, no duplica el consumo.
    await deductFilamentForOrder("o1", deps);
    expect(ledger).toHaveLength(1);

    const restored = await restoreFilamentForOrder("o1", deps);
    expect(restored).toBe(240);
  });
});
