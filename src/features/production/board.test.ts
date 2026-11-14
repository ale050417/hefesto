import { describe, expect, it } from "vitest";
import type { OrderListItem } from "@/features/orders/types";
import {
  buildBoardOrders,
  hoursSince,
  isLate,
  type BoardManualSale,
} from "./board";

const NOW = new Date("2026-10-31T12:00:00.000Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

const order = (over: Partial<OrderListItem>): OrderListItem => ({
  id: "o1",
  orderNumber: "HF-0001",
  customerName: "Juan",
  paymentMethod: "transfer",
  total: 1000,
  status: "in_production",
  createdAt: hoursAgo(5),
  updatedAt: hoursAgo(1),
  itemsSummary: "Mate Mario ×2",
  ...over,
});

const sale = (over: Partial<BoardManualSale>): BoardManualSale => ({
  id: "m1",
  status: "confirmed",
  detail: "5 llaveros",
  customerName: "Feria",
  total: "10000.00",
  saleDate: hoursAgo(10),
  ...over,
});

describe("buildBoardOrders", () => {
  it("une pedidos online y ventas manuales, con el total como número", () => {
    const cards = buildBoardOrders([order({})], [sale({})], NOW);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      id: "o1",
      source: "online",
      label: "Mate Mario ×2",
      total: 1000,
    });
    expect(cards[1]).toMatchObject({
      id: "m1",
      source: "manual",
      label: "5 llaveros",
      total: 10000,
    });
  });

  it("el pedido sin resumen muestra su número; la venta sin detalle, 'Venta manual'", () => {
    const cards = buildBoardOrders(
      [order({ itemsSummary: "" })],
      [sale({ detail: null })],
      NOW,
    );
    expect(cards[0]!.label).toBe("HF-0001");
    expect(cards[1]!.label).toBe("Venta manual");
  });

  it("deja afuera cancelados y reembolsados", () => {
    const cards = buildBoardOrders(
      [order({ status: "cancelled" }), order({ id: "o2", status: "refunded" })],
      [sale({ status: "cancelled" })],
      NOW,
    );
    expect(cards).toEqual([]);
  });

  it("oculta los entregados hace más de un día, no los recientes", () => {
    const cards = buildBoardOrders(
      [
        order({ id: "viejo", status: "delivered", updatedAt: hoursAgo(25) }),
        order({ id: "nuevo", status: "delivered", updatedAt: hoursAgo(23) }),
      ],
      [
        sale({ id: "mviejo", status: "delivered", saleDate: hoursAgo(30) }),
        sale({ id: "mnuevo", status: "delivered", saleDate: hoursAgo(2) }),
      ],
      NOW,
    );
    expect(cards.map((c) => c.id).sort()).toEqual(["mnuevo", "nuevo"]);
  });

  it("incluye todas las etapas del taller", () => {
    const statuses = [
      "pending_payment",
      "confirmed",
      "in_production",
      "ready",
      "shipped",
    ] as const;
    const cards = buildBoardOrders(
      statuses.map((s, i) => order({ id: `o${i}`, status: s })),
      [],
      NOW,
    );
    expect(cards).toHaveLength(5);
  });
});

describe("hoursSince / isLate", () => {
  it("cuenta horas enteras y nunca da negativo", () => {
    expect(hoursSince(hoursAgo(5.9), NOW)).toBe(5);
    expect(hoursSince(new Date(NOW + 3_600_000), NOW)).toBe(0);
    expect(hoursSince(hoursAgo(49).toISOString(), NOW)).toBe(49);
  });

  it("demorado: en taller (confirmado / en producción) y 48 h o más", () => {
    expect(isLate("in_production", 48)).toBe(true);
    expect(isLate("confirmed", 100)).toBe(true);
    expect(isLate("in_production", 47)).toBe(false);
  });

  it("las demás etapas nunca se marcan demoradas", () => {
    expect(isLate("pending_payment", 500)).toBe(false);
    expect(isLate("ready", 500)).toBe(false);
    expect(isLate("shipped", 500)).toBe(false);
    expect(isLate("delivered", 500)).toBe(false);
  });
});
