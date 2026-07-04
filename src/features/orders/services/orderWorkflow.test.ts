import { describe, expect, it, vi } from "vitest";
import { InvalidTransitionError, NotFoundError } from "@/core/errors";
import type { Order, OrderStatus } from "../types";
import {
  canTransition,
  transitionOrderStatus,
  type TransitionDeps,
} from "./orderWorkflow";

function makeDeps(current: OrderStatus | null) {
  const persist = vi.fn<TransitionDeps["persist"]>(
    async (p) => ({ id: "o1", status: p.toStatus }) as unknown as Order,
  );
  const deps: TransitionDeps = {
    getOrder: async () => (current ? { id: "o1", status: current } : null),
    persist,
  };
  return { deps, persist };
}

describe("canTransition", () => {
  it("permite el flujo normal", () => {
    expect(canTransition("pending_payment", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "in_production")).toBe(true);
    expect(canTransition("in_production", "ready")).toBe(true);
    expect(canTransition("ready", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("rechaza saltos inválidos", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("confirmed", "delivered")).toBe(false);
  });

  it("estados terminales no transicionan", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("refunded", "confirmed")).toBe(false);
    expect(canTransition("delivered", "shipped")).toBe(false);
  });
});

describe("transitionOrderStatus", () => {
  it("aplica una transición válida y registra from/to", async () => {
    const { deps, persist } = makeDeps("confirmed");
    await transitionOrderStatus(
      "o1",
      "in_production",
      { changedBy: "u1", note: "A producción" },
      deps,
    );
    expect(persist.mock.calls[0]![0]).toMatchObject({
      orderId: "o1",
      fromStatus: "confirmed",
      toStatus: "in_production",
      changedBy: "u1",
      note: "A producción",
    });
  });

  // Auditoría 2026-07 (I2): confirmar manualmente (transferencia/efectivo)
  // marca paid_at, igual que el webhook de MP (Cap. 11).
  it("al confirmar marca paidAt", async () => {
    const { deps, persist } = makeDeps("pending_payment");
    await transitionOrderStatus("o1", "confirmed", { changedBy: "u1" }, deps);
    const params = persist.mock.calls[0]![0];
    expect(params.toStatus).toBe("confirmed");
    expect(params.paidAt).toBeInstanceOf(Date);
  });

  it("las demás transiciones NO tocan paidAt", async () => {
    const { deps, persist } = makeDeps("confirmed");
    await transitionOrderStatus("o1", "in_production", {}, deps);
    expect(persist.mock.calls[0]![0].paidAt).toBeUndefined();
  });

  it("rechaza una transición inválida sin persistir", async () => {
    const { deps, persist } = makeDeps("pending_payment");
    await expect(
      transitionOrderStatus("o1", "delivered", {}, deps),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(persist).not.toHaveBeenCalled();
  });

  it("rechaza transicionar desde un estado terminal", async () => {
    const { deps } = makeDeps("cancelled");
    await expect(
      transitionOrderStatus("o1", "confirmed", {}, deps),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("lanza NotFound si el pedido no existe", async () => {
    const { deps } = makeDeps(null);
    await expect(
      transitionOrderStatus("x", "confirmed", {}, deps),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
