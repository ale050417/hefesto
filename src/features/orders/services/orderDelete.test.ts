import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/core/errors";
import type { Order, OrderStatus } from "../types";

// Mockeamos el repository (única puerta a la DB): así testeamos la REGLA de
// negocio del borrado sin base real. Los nombres van con prefijo `mock` porque
// vitest iza el vi.mock por encima de los imports.
const mockFindOrderById = vi.fn();
const mockDeleteOrder = vi.fn();
const mockRestoreFilament = vi.fn();

vi.mock("../repository", () => ({
  findOrderById: (...args: unknown[]) => mockFindOrderById(...args),
  deleteOrder: (...args: unknown[]) => mockDeleteOrder(...args),
  // El resto del módulo no se usa acá, pero el service lo importa igual.
  countOrdersByStatus: vi.fn(),
  findOrderDetailForAdmin: vi.fn(),
  findOrdersForAdmin: vi.fn(),
  updateOrderMeta: vi.fn(),
}));

vi.mock("./orderWorkflow", () => ({ transitionOrderStatus: vi.fn() }));

// El borrado repone el filamento descontado (diseño 2026-07) vía ledger.
vi.mock("./orderInventory", () => ({
  restoreFilamentForOrder: (...args: unknown[]) => mockRestoreFilament(...args),
}));

import { deleteOrderAdmin, deleteOrdersAdmin } from "./orderAdminService";

function order(status: OrderStatus): Order {
  return { id: "o1", status } as unknown as Order;
}

// Todos los estados de un pedido: el borrado total debe funcionar en TODOS
// (incluye pagados/entregados y pedidos mal creados). La reversa de puntos/
// cupón vive en repository.deleteOrder (transaccional).
const ALL_STATUSES: OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

afterEach(() => {
  mockFindOrderById.mockReset();
  mockDeleteOrder.mockReset();
  mockRestoreFilament.mockReset();
});

describe("deleteOrderAdmin", () => {
  it("borra un pedido en CUALQUIER estado (hard delete)", async () => {
    for (const status of ALL_STATUSES) {
      mockFindOrderById.mockResolvedValueOnce(order(status));
      await deleteOrderAdmin("o1");
      expect(mockDeleteOrder).toHaveBeenCalledWith("o1");
      mockDeleteOrder.mockClear();
    }
  });

  it("repone el filamento ANTES de borrar (reversa idempotente vía ledger)", async () => {
    const calls: string[] = [];
    mockFindOrderById.mockResolvedValue(order("confirmed"));
    mockRestoreFilament.mockImplementation(async () => calls.push("restore"));
    mockDeleteOrder.mockImplementation(async () => calls.push("delete"));

    await deleteOrderAdmin("o1");

    expect(mockRestoreFilament).toHaveBeenCalledWith("o1");
    expect(calls).toEqual(["restore", "delete"]);
  });

  it("lanza NotFound si el pedido no existe y NO toca la base", async () => {
    mockFindOrderById.mockResolvedValue(null);
    await expect(deleteOrderAdmin("x")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteOrder).not.toHaveBeenCalled();
    expect(mockRestoreFilament).not.toHaveBeenCalled();
  });
});

describe("deleteOrdersAdmin", () => {
  it("borra todos los pedidos existentes y devuelve la cantidad", async () => {
    mockFindOrderById.mockResolvedValue(order("confirmed"));
    const deleted = await deleteOrdersAdmin(["a", "b", "c"]);
    expect(deleted).toBe(3);
    expect(mockDeleteOrder).toHaveBeenCalledTimes(3);
    expect(mockRestoreFilament).toHaveBeenCalledTimes(3); // reversa por pedido
    expect(mockDeleteOrder).toHaveBeenCalledWith("a");
    expect(mockDeleteOrder).toHaveBeenCalledWith("b");
    expect(mockDeleteOrder).toHaveBeenCalledWith("c");
  });

  it("ignora los pedidos que ya no existen (no rompe) y cuenta solo los borrados", async () => {
    mockFindOrderById
      .mockResolvedValueOnce(order("pending_payment")) // a: existe
      .mockResolvedValueOnce(null) // b: ya no está
      .mockResolvedValueOnce(order("delivered")); // c: existe
    const deleted = await deleteOrdersAdmin(["a", "b", "c"]);
    expect(deleted).toBe(2);
    expect(mockDeleteOrder).toHaveBeenCalledTimes(2);
    expect(mockDeleteOrder).toHaveBeenCalledWith("a");
    expect(mockDeleteOrder).toHaveBeenCalledWith("c");
    expect(mockDeleteOrder).not.toHaveBeenCalledWith("b");
  });
});
