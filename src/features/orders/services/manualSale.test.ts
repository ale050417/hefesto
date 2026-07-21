import { describe, expect, it, vi } from "vitest";
import { resolveFilamentForManualSale } from "@/features/inventory/service";
import type { Filament, NewFilamentMovement } from "@/features/inventory/types";
import { manualSaleSchema } from "../schemas";
import {
  computeManualSaleCosts,
  deductFilamentForManualSale,
  stockActionForTransition,
  toManualSaleRow,
  type ManualSaleStockDeps,
} from "./manualSaleService";

const base = {
  saleDate: "2025-11-02",
  customerName: "Juan Pérez",
  detail: "3 llaveros",
  total: 12500,
  paymentMethod: "cash" as const,
  status: "delivered" as const,
};

describe("manualSaleSchema", () => {
  it("acepta una venta válida", () => {
    const r = manualSaleSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.total).toBe(12500);
      expect(r.data.customerName).toBe("Juan Pérez");
    }
  });

  it("coerce el total desde string", () => {
    const r = manualSaleSchema.safeParse({ ...base, total: "9900" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.total).toBe(9900);
  });

  it("rechaza total 0 o negativo", () => {
    expect(manualSaleSchema.safeParse({ ...base, total: 0 }).success).toBe(
      false,
    );
    expect(manualSaleSchema.safeParse({ ...base, total: -100 }).success).toBe(
      false,
    );
  });

  it("rechaza cliente vacío", () => {
    expect(
      manualSaleSchema.safeParse({ ...base, customerName: "   " }).success,
    ).toBe(false);
  });

  it("convierte detalle vacío en undefined", () => {
    const r = manualSaleSchema.safeParse({ ...base, detail: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.detail).toBeUndefined();
  });

  it("rechaza un estado inválido", () => {
    expect(
      manualSaleSchema.safeParse({ ...base, status: "lo_que_sea" }).success,
    ).toBe(false);
  });

  it("acepta un reparto (profitSplit) válido", () => {
    const r = manualSaleSchema.safeParse({
      ...base,
      profitSplit: [
        { name: "Yo", pct: 60 },
        { name: "Socio", pct: "40" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.profitSplit).toEqual([
        { name: "Yo", pct: 60 },
        { name: "Socio", pct: 40 },
      ]);
    }
  });

  // Regla de dinero (auditoría 2026-07, I5): la suma del reparto se valida en
  // el servidor, no solo en la UI.
  it("rechaza un reparto que no suma 100%", () => {
    expect(
      manualSaleSchema.safeParse({
        ...base,
        profitSplit: [
          { name: "Yo", pct: 100 },
          { name: "Socio", pct: 100 },
        ],
      }).success,
    ).toBe(false);
    expect(
      manualSaleSchema.safeParse({
        ...base,
        profitSplit: [{ name: "Yo", pct: 40 }],
      }).success,
    ).toBe(false);
  });

  it("acepta suma 100% con decimales (tolerancia)", () => {
    const r = manualSaleSchema.safeParse({
      ...base,
      profitSplit: [
        { name: "A", pct: 33.33 },
        { name: "B", pct: 33.33 },
        { name: "C", pct: 33.34 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("un reparto vacío sigue siendo válido (divide por socios actuales)", () => {
    const r = manualSaleSchema.safeParse({ ...base, profitSplit: [] });
    expect(r.success).toBe(true);
  });

  // Fix auditoría 2026-07 (bug 2): cantidad de unidades en la venta manual.
  it("cantidad: default 1, coerce desde string, rechaza 0/negativos/decimales", () => {
    const r = manualSaleSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(1);

    const r80 = manualSaleSchema.safeParse({ ...base, quantity: "80" });
    expect(r80.success).toBe(true);
    if (r80.success) expect(r80.data.quantity).toBe(80);

    expect(manualSaleSchema.safeParse({ ...base, quantity: 0 }).success).toBe(
      false,
    );
    expect(manualSaleSchema.safeParse({ ...base, quantity: -3 }).success).toBe(
      false,
    );
    expect(manualSaleSchema.safeParse({ ...base, quantity: 2.5 }).success).toBe(
      false,
    );
  });

  it("acepta filamentId (uuid) y convierte vacío en undefined", () => {
    const r = manualSaleSchema.safeParse({
      ...base,
      filamentId: "0f8b7a52-3f1e-4c9a-9d2b-1a2b3c4d5e6f",
    });
    expect(r.success).toBe(true);
    const rEmpty = manualSaleSchema.safeParse({ ...base, filamentId: "" });
    expect(rEmpty.success).toBe(true);
    if (rEmpty.success) expect(rEmpty.data.filamentId).toBeUndefined();
    expect(
      manualSaleSchema.safeParse({ ...base, filamentId: "no-es-uuid" }).success,
    ).toBe(false);
  });
});

// La calculadora cotiza UNA pieza; la venta escala por cantidad (dinero → test).
describe("computeManualSaleCosts", () => {
  it("multiplica la amortización unitaria por la cantidad", () => {
    const r = computeManualSaleCosts({
      unitAmortization: 1500.5,
      total: 200000,
      quantity: 80,
    });
    expect(r.amortization).toBe(120040);
    expect(r.profit).toBe(79960);
  });

  it("cantidad 1 = comportamiento anterior", () => {
    const r = computeManualSaleCosts({
      unitAmortization: 3200,
      total: 12500,
      quantity: 1,
    });
    expect(r.amortization).toBe(3200);
    expect(r.profit).toBe(9300);
  });

  it("la ganancia nunca es negativa (venta a pérdida queda en 0)", () => {
    const r = computeManualSaleCosts({
      unitAmortization: 5000,
      total: 8000,
      quantity: 3,
    });
    expect(r.amortization).toBe(15000);
    expect(r.profit).toBe(0);
  });

  it("sanea cantidades raras (0/decimales → al menos 1, entero)", () => {
    expect(
      computeManualSaleCosts({
        unitAmortization: 100,
        total: 1000,
        quantity: 0,
      }).amortization,
    ).toBe(100);
    expect(
      computeManualSaleCosts({
        unitAmortization: 100,
        total: 1000,
        quantity: 2.9,
      }).amortization,
    ).toBe(200);
  });
});

// Stock (diseño 2026-07): la venta manual descuenta filamento. Toca stock →
// tests en el mismo paso (Cap. 15). Dobles puros, sin DB.
describe("deductFilamentForManualSale", () => {
  const filaments = [
    { id: "f1", material: "PLA", color: "Negro" },
    { id: "f2", material: "PLA", color: "Rojo" },
    { id: "f3", material: "PETG", color: "Rojo" },
  ] as unknown as Filament[];

  function makeDeps(overrides: Partial<ManualSaleStockDeps> = {}) {
    const applyDeltas = vi.fn<ManualSaleStockDeps["applyDeltas"]>(
      async () => [],
    );
    const audit = vi.fn(async () => undefined);
    const deps: ManualSaleStockDeps = {
      listFilaments: async () => filaments,
      hasMovements: async () => false,
      applyDeltas,
      resolveFilament: resolveFilamentForManualSale,
      audit: audit as unknown as ManualSaleStockDeps["audit"],
      ...overrides,
    };
    return { deps, applyDeltas, audit };
  }

  it("multicolor: descuenta cada color/carrete de su filamento", async () => {
    const { deps, applyDeltas } = makeDeps();
    await deductFilamentForManualSale(
      "sMC",
      {
        quantity: 2,
        colorLines: [
          { filamentId: "f1", grams: 30 },
          { filamentId: "f2", grams: 20 },
        ],
      },
      deps,
    );
    const movs = applyDeltas.mock.calls[0]![0] as NewFilamentMovement[];
    expect(movs).toHaveLength(2);
    expect(movs.map((m) => m.deltaGrams)).toEqual([-60, -40]);
    expect(movs.map((m) => m.color)).toEqual(["Negro", "Rojo"]);
  });

  it("descuenta gramos (por unidad) × cantidad del filamento elegido", async () => {
    const { deps, applyDeltas } = makeDeps();
    const res = await deductFilamentForManualSale(
      "s1",
      { filamentId: "f2", grams: 50, quantity: 80 },
      deps,
    );
    expect(res.deducted).toBe(true);
    const movements = applyDeltas.mock.calls[0]![0] as NewFilamentMovement[];
    expect(movements).toEqual([
      {
        filamentId: "f2",
        material: "PLA",
        color: "Rojo",
        deltaGrams: -4000, // 50 g × 80
        reason: "manual_sale",
        refId: "s1",
      },
    ]);
  });

  it("sin filamentId matchea por material SOLO si hay uno único", async () => {
    const { deps, applyDeltas } = makeDeps();
    const res = await deductFilamentForManualSale(
      "s1",
      { material: "PETG", grams: 30, quantity: 2 },
      deps,
    );
    expect(res.deducted).toBe(true);
    expect(
      (applyDeltas.mock.calls[0]![0] as NewFilamentMovement[])[0],
    ).toMatchObject({ filamentId: "f3", deltaGrams: -60 });
  });

  it("material ambiguo → NO adivina: saltea con warning en auditoría", async () => {
    const { deps, applyDeltas, audit } = makeDeps();
    const res = await deductFilamentForManualSale(
      "s1",
      { material: "PLA", grams: 30, quantity: 1 },
      deps,
    );
    expect(res.deducted).toBe(false);
    expect(applyDeltas).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.manual_sale_no_deduct",
      }),
    );
  });

  it("con filamento/material pero sin gramos → warning (nunca 0 silencioso)", async () => {
    const { deps, applyDeltas, audit } = makeDeps();
    const res = await deductFilamentForManualSale(
      "s1",
      { filamentId: "f1", grams: 0, quantity: 1 },
      deps,
    );
    expect(res.deducted).toBe(false);
    expect(res.reason).toBe("sin gramos");
    expect(applyDeltas).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });

  it("sin filamento NI material (carga histórica) → se saltea en silencio", async () => {
    const { deps, applyDeltas, audit } = makeDeps();
    const res = await deductFilamentForManualSale(
      "s1",
      { grams: 50, quantity: 1 },
      deps,
    );
    expect(res.deducted).toBe(false);
    expect(applyDeltas).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("es idempotente: si la venta ya descontó, no repite", async () => {
    const { deps, applyDeltas } = makeDeps({ hasMovements: async () => true });
    const res = await deductFilamentForManualSale(
      "s1",
      { filamentId: "f1", grams: 50, quantity: 1 },
      deps,
    );
    expect(res.deducted).toBe(false);
    expect(applyDeltas).not.toHaveBeenCalled();
  });

  it("NUNCA lanza: un error de DB queda auditado y la venta sigue", async () => {
    const { deps, audit } = makeDeps({
      applyDeltas: vi.fn(async () => {
        throw new Error("DB caída");
      }),
    });
    await expect(
      deductFilamentForManualSale(
        "s1",
        { filamentId: "f1", grams: 50, quantity: 1 },
        deps,
      ),
    ).resolves.toMatchObject({ deducted: false });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.manual_sale_deduct_failed",
      }),
    );
  });
});

describe("toManualSaleRow (profit_split)", () => {
  const input = {
    saleDate: "2025-11-02",
    customerName: "Juan Pérez",
    quantity: 1,
    total: 12500,
    paymentMethod: "cash" as const,
    status: "delivered" as const,
  };

  it("guarda la cantidad en la fila", () => {
    const row = toManualSaleRow({ ...input, quantity: 80 }, null);
    expect(row.quantity).toBe(80);
  });

  it("sin reparto → profit_split null (divide por socios actuales)", () => {
    const row = toManualSaleRow(input, null);
    expect(row.profitSplit).toBeNull();
  });

  it("con reparto → guarda solo las partes con % > 0", () => {
    const row = toManualSaleRow(
      {
        ...input,
        profitSplit: [
          { name: "Yo", pct: 100 },
          { name: "Vacío", pct: 0 },
        ],
      },
      null,
    );
    expect(row.profitSplit).toEqual([{ name: "Yo", pct: 100 }]);
  });
});

describe("stockActionForTransition (cuándo tocar stock, Bloque C)", () => {
  it("descuenta al ENTRAR a confirmado (la venta pasa a cobrada)", () => {
    expect(stockActionForTransition("pending_payment", "confirmed")).toBe(
      "deduct",
    );
  });

  it("NO vuelve a descontar entre estados ya cobrados", () => {
    expect(stockActionForTransition("confirmed", "in_production")).toBe("none");
    expect(stockActionForTransition("ready", "shipped")).toBe("none");
  });

  it("repone al cancelar o reembolsar", () => {
    expect(stockActionForTransition("confirmed", "cancelled")).toBe("restore");
    expect(stockActionForTransition("delivered", "refunded")).toBe("restore");
  });

  it("cancelar desde pendiente (nunca descontó) pide restore (idempotente)", () => {
    expect(stockActionForTransition("pending_payment", "cancelled")).toBe(
      "restore",
    );
  });
});

describe("toManualSaleRow (filamento persistido, Bloque C)", () => {
  const input = {
    saleDate: "2025-11-02",
    customerName: "Juan Pérez",
    quantity: 2,
    total: 12500,
    paymentMethod: "cash" as const,
    status: "pending_payment" as const,
  };

  it("guarda filamento, gramos y colores para descontar al confirmar", () => {
    const row = toManualSaleRow(
      {
        ...input,
        filamentId: "f1",
        grams: 50,
        colorLines: [{ filamentId: "f1", grams: 30 }],
      },
      null,
    );
    expect(row.filamentId).toBe("f1");
    expect(row.grams).toBe("50");
    expect(row.colorLines).toEqual([{ filamentId: "f1", grams: 30 }]);
  });

  it("sin filamento → columnas null", () => {
    const row = toManualSaleRow(input, null);
    expect(row.filamentId).toBeNull();
    expect(row.grams).toBeNull();
    expect(row.colorLines).toBeNull();
  });
});
