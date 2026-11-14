import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/core/errors";
import { manualSaleSchema } from "./schemas";

// Se mockea todo lo que toca la base o Next; la cuenta de plata (líneas →
// total/gramos/costo) es la REAL, que es lo que importa probar acá.
const mockRevalidate = vi.fn();
const mockAudit = vi.fn();
const mockAmortization = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockDeleteOrder = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidate(...a),
}));
vi.mock("@/core/audit", () => ({
  recordAudit: (...a: unknown[]) => mockAudit(...a),
}));
vi.mock("@/features/calculator/service", () => ({
  getAmortization: (...a: unknown[]) => mockAmortization(...a),
}));
vi.mock("./services/manualSaleService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/manualSaleService")>()),
  createManualSale: (...a: unknown[]) => mockCreate(...a),
  updateManualSale: (...a: unknown[]) => mockUpdate(...a),
  deleteManualSale: (...a: unknown[]) => mockDelete(...a),
}));
vi.mock("./services/orderAdminService", () => ({
  deleteOrderAdmin: (...a: unknown[]) => mockDeleteOrder(...a),
}));

import {
  editManualSale,
  registerManualSale,
  removeManualSale,
  removeOnlineOrder,
} from "./manual-sale-flow";

const F1 = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

function simpleSale(over: Record<string, unknown> = {}) {
  return manualSaleSchema.parse({
    saleDate: "2026-10-31",
    customerName: "Juan",
    detail: "3 llaveros",
    quantity: 3,
    total: 9000,
    paymentMethod: "cash",
    status: "pending_payment",
    filamentId: F1,
    grams: 10,
    printMinutes: 30,
    ...over,
  });
}

describe("registerManualSale", () => {
  it("venta simple: costo = amortización unitaria × cantidad (+ insumos); ganancia = total − costo", async () => {
    mockAmortization.mockResolvedValue(500);
    mockCreate.mockImplementation(async (input) => ({
      id: "s1",
      total: String(input.total),
      customerName: "Juan",
    }));

    const sale = await registerManualSale({
      input: simpleSale({ extrasCost: 100 }),
      actorId: "u1",
    });

    expect(sale.id).toBe("s1");
    expect(mockAmortization).toHaveBeenCalledWith({
      filamentId: F1,
      material: null,
      grams: 10,
      hours: 0.5,
    });
    const [saved, createdBy] = mockCreate.mock.calls[0]!;
    expect(createdBy).toBe("u1");
    expect(saved.amortization).toBe(1600); // 500 × 3 + 100 de insumos
    expect(saved.profit).toBe(7400); // 9000 − 1600
  });

  it("sin costo calculable y sin costo explícito: se rechaza como en la web", async () => {
    mockAmortization.mockResolvedValue(0);
    await expect(
      registerManualSale({ input: simpleSale(), actorId: "u1" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("con costo explícito (texto libre) se guarda aunque el filamento no dé costo", async () => {
    mockAmortization.mockResolvedValue(0);
    mockCreate.mockImplementation(async (input) => ({
      id: "s2",
      total: String(input.total),
      customerName: "Juan",
    }));

    await registerManualSale({
      input: simpleSale({
        filamentId: undefined,
        grams: undefined,
        total: 6000,
      }),
      actorId: "u1",
      manualCost: 1000,
    });

    const [saved] = mockCreate.mock.calls[0]!;
    expect(saved.amortization).toBe(1000);
    expect(saved.profit).toBe(5000);
  });

  it("costo explícito 0 es válido (venta sin costo dicha a propósito)", async () => {
    mockAmortization.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "s3", total: "100", customerName: "x" });
    await registerManualSale({
      input: simpleSale({ total: 100 }),
      actorId: null,
      manualCost: 0,
    });
    const [saved] = mockCreate.mock.calls[0]!;
    expect(saved.amortization).toBe(0);
    expect(saved.profit).toBe(100);
  });

  it("mezcla de líneas con y sin carrete: suma el costo del filamento y el explícito", async () => {
    mockAmortization.mockResolvedValue(400);
    mockCreate.mockResolvedValue({
      id: "s4",
      total: "5000",
      customerName: "x",
    });
    const input = manualSaleSchema.parse({
      saleDate: "2026-10-31",
      customerName: "Ana",
      quantity: 2,
      total: 5000,
      paymentMethod: "transfer",
      status: "confirmed",
      items: [
        {
          productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          productName: "Mate",
          quantity: 1,
          unitPrice: 3000,
          printMinutes: 60,
          colorLines: [{ filamentId: F1, grams: 100 }],
        },
        { productName: "Servicio", quantity: 1, unitPrice: 2000 },
      ],
    });
    await registerManualSale({ input, actorId: "u1", manualCost: 700 });
    const [saved] = mockCreate.mock.calls[0]!;
    // Con líneas el costo del filamento se calcula UNA vez (cantidad 1).
    expect(saved.amortization).toBe(1100); // 400 + 700
    expect(saved.profit).toBe(3900);
  });

  it("revalida las pantallas y deja auditoría con total y cliente", async () => {
    mockAmortization.mockResolvedValue(100);
    mockCreate.mockResolvedValue({
      id: "s5",
      total: "9000.00",
      customerName: "Juan",
    });
    await registerManualSale({ input: simpleSale(), actorId: "u9" });

    expect(mockRevalidate.mock.calls.map((c) => c[0])).toEqual([
      "/admin/pedidos",
      "/admin/ganancias",
      "/admin/reportes",
    ]);
    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "u9",
      action: "manual_sale.created",
      entityType: "manual_sale",
      entityId: "s5",
      metadata: { total: "9000.00", customer: "Juan" },
    });
  });
});

describe("editManualSale", () => {
  it("edita, revalida y audita con el total nuevo", async () => {
    const input = {
      saleDate: "2026-10-31",
      customerName: "Juan",
      total: 12000,
      amortization: 3000,
      paymentMethod: "cash" as const,
    };
    await editManualSale({ saleId: "s1", input, actorId: "u1" });
    expect(mockUpdate).toHaveBeenCalledWith("s1", input);
    expect(mockRevalidate).toHaveBeenCalledTimes(3);
    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "manual_sale.updated",
      entityType: "manual_sale",
      entityId: "s1",
      metadata: { total: 12000 },
    });
  });

  it("si la edición falla no audita ni revalida", async () => {
    mockUpdate.mockRejectedValueOnce(
      new ValidationError("No encontramos la venta."),
    );
    await expect(
      editManualSale({
        saleId: "x",
        actorId: null,
        input: {
          saleDate: "2026-10-31",
          customerName: "J",
          total: 1,
          amortization: 0,
          paymentMethod: "cash",
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});

describe("removeManualSale / removeOnlineOrder", () => {
  it("borrar venta manual: borra (con reposición de filamento en el service), audita y revalida", async () => {
    await removeManualSale({ saleId: "s1", actorId: "u1" });
    expect(mockDelete).toHaveBeenCalledWith("s1");
    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "manual_sale.deleted",
      entityType: "manual_sale",
      entityId: "s1",
    });
    expect(mockRevalidate).toHaveBeenCalledTimes(3);
  });

  it("borrar pedido online: delega en deleteOrderAdmin y audita order.deleted", async () => {
    await removeOnlineOrder({ orderId: "o1", actorId: "u1" });
    expect(mockDeleteOrder).toHaveBeenCalledWith("o1");
    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "u1",
      action: "order.deleted",
      entityType: "order",
      entityId: "o1",
    });
    expect(mockRevalidate.mock.calls.map((c) => c[0])).toContain(
      "/admin/reportes",
    );
  });

  it("pedido inexistente: el NotFoundError sale tal cual y no audita", async () => {
    mockDeleteOrder.mockRejectedValueOnce(
      new NotFoundError("No encontramos el pedido."),
    );
    await expect(
      removeOnlineOrder({ orderId: "nope", actorId: "u1" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
