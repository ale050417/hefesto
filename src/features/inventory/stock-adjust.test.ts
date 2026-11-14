import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/core/errors";
import {
  adjustFilamentStock,
  planStockAdjust,
  type AdjustStockDeps,
} from "./stock-adjust";
import { stockAdjustSchema } from "./schemas";
import type { Filament, LowStockFilament } from "./types";

const filament = {
  id: "f1",
  material: "PLA",
  color: "Rojo",
  stockGrams: "500.00",
  alertThresholdGrams: "200.00",
} as unknown as Filament;

describe("planStockAdjust", () => {
  it("suma un delta positivo", () => {
    expect(planStockAdjust(500, { deltaGrams: 1000 })).toEqual({
      deltaGrams: 1000,
      newStock: 1500,
    });
  });

  it("resta un delta negativo", () => {
    expect(planStockAdjust(500, { deltaGrams: -120 })).toEqual({
      deltaGrams: -120,
      newStock: 380,
    });
  });

  it("permite dejar el stock justo en 0", () => {
    expect(planStockAdjust(500, { deltaGrams: -500 }).newStock).toBe(0);
  });

  it("NO deja el stock negativo al restar", () => {
    expect(() => planStockAdjust(500, { deltaGrams: -501 })).toThrow(
      /solo hay 500 g/,
    );
    expect(() => planStockAdjust(0, { deltaGrams: -1 })).toThrow(
      /No hay stock para restar/,
    );
  });

  it("rechaza un delta en 0", () => {
    expect(() => planStockAdjust(500, { deltaGrams: 0 })).toThrow(
      ValidationError,
    );
  });

  it("stock contado: calcula el delta contra el actual", () => {
    expect(planStockAdjust(500, { newStockGrams: 320 })).toEqual({
      deltaGrams: -180,
      newStock: 320,
    });
    expect(planStockAdjust(500, { newStockGrams: 800 })).toEqual({
      deltaGrams: 300,
      newStock: 800,
    });
  });

  it("stock contado igual al actual no es un ajuste", () => {
    expect(() => planStockAdjust(500, { newStockGrams: 500 })).toThrow(
      /ya es de 500 g/,
    );
  });

  it("stock contado desde una deuda (negativo) sube hasta el valor contado", () => {
    // Debía 30 g (stock -30); se cuenta 0 → +30 al ledger.
    expect(planStockAdjust(-30, { newStockGrams: 0 })).toEqual({
      deltaGrams: 30,
      newStock: 0,
    });
  });

  it("sumar con deuda previa compensa el déficit (no se bloquea)", () => {
    expect(planStockAdjust(-30, { deltaGrams: 1000 }).newStock).toBe(970);
  });

  it("redondea a 2 decimales", () => {
    expect(planStockAdjust(100, { deltaGrams: 0.1 + 0.2 }).deltaGrams).toBe(
      0.3,
    );
  });

  it("rechaza valores no finitos o negativos en el stock contado", () => {
    expect(() => planStockAdjust(5, { newStockGrams: -1 })).toThrow(
      ValidationError,
    );
    expect(() => planStockAdjust(5, { deltaGrams: Number.NaN })).toThrow(
      ValidationError,
    );
  });
});

function makeDeps(over: Partial<AdjustStockDeps> = {}) {
  const applyDeltas = vi.fn<AdjustStockDeps["applyDeltas"]>(async () => []);
  const notifyLow = vi.fn<AdjustStockDeps["notifyLow"]>(async () => {});
  const audit = vi.fn<AdjustStockDeps["audit"]>(async () => {});
  const deps: AdjustStockDeps = {
    findFilament: async () => filament,
    applyDeltas,
    notifyLow,
    audit,
    ...over,
  };
  return { deps, applyDeltas, notifyLow, audit };
}

describe("adjustFilamentStock", () => {
  it("aplica el delta por el ledger con reason 'adjust' y sin refId", async () => {
    const { deps, applyDeltas } = makeDeps();
    const res = await adjustFilamentStock(
      { id: "f1", input: { deltaGrams: 1000 }, actorId: "u1" },
      deps,
    );
    expect(applyDeltas).toHaveBeenCalledWith([
      {
        filamentId: "f1",
        material: "PLA",
        color: "Rojo",
        deltaGrams: 1000,
        reason: "adjust",
        refId: null,
      },
    ]);
    expect(res).toEqual({
      deltaGrams: 1000,
      previousStock: 500,
      newStock: 1500,
      lowStock: false,
    });
  });

  it("audita con el motivo, el stock anterior y el nuevo", async () => {
    const { deps, audit } = makeDeps();
    await adjustFilamentStock(
      {
        id: "f1",
        input: { newStockGrams: 320 },
        reason: "  Conteo físico  ",
        actorId: "u1",
      },
      deps,
    );
    expect(audit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "inventory.stock_adjusted",
      entityType: "filament",
      entityId: "f1",
      metadata: {
        material: "PLA",
        color: "Rojo",
        deltaGrams: -180,
        previousStock: 500,
        newStock: 320,
        reason: "Conteo físico",
      },
    });
  });

  it("avisa al panel cuando quedó bajo el umbral", async () => {
    const low: LowStockFilament[] = [
      {
        filamentId: "f1",
        material: "PLA",
        color: "Rojo",
        stockGrams: 150,
        threshold: 200,
      },
    ];
    const { deps, notifyLow } = makeDeps({ applyDeltas: async () => low });
    const res = await adjustFilamentStock(
      { id: "f1", input: { deltaGrams: -350 }, actorId: null },
      deps,
    );
    expect(notifyLow).toHaveBeenCalledWith(low);
    expect(res.lowStock).toBe(true);
  });

  it("si el aviso falla, el ajuste igual se completa", async () => {
    const low: LowStockFilament[] = [
      {
        filamentId: "f1",
        material: "PLA",
        color: "Rojo",
        stockGrams: 0,
        threshold: 200,
      },
    ];
    const { deps, audit } = makeDeps({
      applyDeltas: async () => low,
      notifyLow: async () => {
        throw new Error("push caído");
      },
    });
    await expect(
      adjustFilamentStock(
        { id: "f1", input: { deltaGrams: -500 }, actorId: null },
        deps,
      ),
    ).resolves.toMatchObject({ newStock: 0, lowStock: true });
    expect(audit).toHaveBeenCalledOnce();
  });

  it("carrete inexistente → NotFoundError y no toca nada", async () => {
    const { deps, applyDeltas, audit } = makeDeps({
      findFilament: async () => null,
    });
    await expect(
      adjustFilamentStock(
        { id: "nope", input: { deltaGrams: 10 }, actorId: null },
        deps,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(applyDeltas).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("un ajuste inválido no llega al ledger", async () => {
    const { deps, applyDeltas } = makeDeps();
    await expect(
      adjustFilamentStock(
        { id: "f1", input: { deltaGrams: -9999 }, actorId: null },
        deps,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(applyDeltas).not.toHaveBeenCalled();
  });
});

describe("stockAdjustSchema", () => {
  it("acepta deltaGrams o newStockGrams, nunca los dos ni ninguno", () => {
    expect(stockAdjustSchema.safeParse({ deltaGrams: -50 }).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ newStockGrams: 0 }).success).toBe(
      true,
    );
    expect(
      stockAdjustSchema.safeParse({ deltaGrams: 1, newStockGrams: 1 }).success,
    ).toBe(false);
    expect(stockAdjustSchema.safeParse({}).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ reason: "x" }).success).toBe(false);
  });

  it("no acepta un stock contado negativo ni un motivo larguísimo", () => {
    expect(stockAdjustSchema.safeParse({ newStockGrams: -1 }).success).toBe(
      false,
    );
    expect(
      stockAdjustSchema.safeParse({ deltaGrams: 5, reason: "x".repeat(201) })
        .success,
    ).toBe(false);
  });
});
