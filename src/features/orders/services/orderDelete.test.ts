import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/core/errors";
import type { Order, OrderStatus } from "../types";

// Mockeamos el repository (única puerta a la DB): así testeamos la REGLA de
// negocio del borrado sin base real. Los nombres van con prefijo `mock` porque
// vitest iza el vi.mock por encima de los imports.
const mockFindOrderById = vi.fn();
const mockDeleteOrder = vi.fn();

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

import { canDeleteOrder, deleteOrderAdmin } from "./orderAdminService";

function order(status: OrderStatus): Order {
  return { id: "o1", status } as unknown as Order;
}

afterEach(() => {
  mockFindOrderById.mockReset();
  mockDeleteOrder.mockReset();
});

describe("canDeleteOrder", () => {
  it("permite borrar solo pedidos que nunca tocaron plata", () => {
    expect(canDeleteOrder("pending_payment")).toBe(true);
    expect(canDeleteOrder("cancelled")).toBe(true);
  });

  it("rechaza cualquier estado con plata de por medio", () => {
    for (const s of [
      "confirmed",
      "in_production",
      "ready",
      "shipped",
      "delivered",
      "refunded",
    ] as OrderStatus[]) {
      expect(canDeleteOrder(s)).toBe(false);
    }
  });
});

describe("deleteOrderAdmin", () => {
  it("borra un pedido pendiente de pago", async () => {
    mockFindOrderById.mockResolvedValue(order("pending_payment"));
    await deleteOrderAdmin("o1");
    expect(mockDeleteOrder).toHaveBeenCalledWith("o1");
  });

  it("borra un pedido cancelado", async () => {
    mockFindOrderById.mockResolvedValue(order("cancelled"));
    await deleteOrderAdmin("o1");
    expect(mockDeleteOrder).toHaveBeenCalledWith("o1");
  });

  it("rechaza borrar un pedido pagado y NO toca la base", async () => {
    mockFindOrderById.mockResolvedValue(order("confirmed"));
    await expect(deleteOrderAdmin("o1")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockDeleteOrder).not.toHaveBeenCalled();
  });

  it("rechaza borrar un pedido entregado y NO toca la base", async () => {
    mockFindOrderById.mockResolvedValue(order("delivered"));
    await expect(deleteOrderAdmin("o1")).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(mockDeleteOrder).not.toHaveBeenCalled();
  });

  it("lanza NotFound si el pedido no existe", async () => {
    mockFindOrderById.mockResolvedValue(null);
    await expect(deleteOrderAdmin("x")).rejects.toBeInstanceOf(NotFoundError);
    expect(mockDeleteOrder).not.toHaveBeenCalled();
  });
});
