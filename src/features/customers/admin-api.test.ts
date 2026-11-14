import { describe, expect, it } from "vitest";
import {
  customerCounts,
  customerDetailToJson,
  customerToJson,
  filterAdminCustomers,
  tiersInfo,
} from "./admin-api";
import type { AdminCustomer } from "./service";

function cust(over: Partial<AdminCustomer> = {}): AdminCustomer {
  return {
    id: "c1",
    source: "registered",
    name: "Juan Pérez",
    email: "juan@mail.com",
    phone: "+54 3757 62-4148",
    city: "Posadas",
    note: null,
    since: new Date("2026-03-01T12:00:00Z"),
    orders: 2,
    spent: 30000,
    tier: "bronze",
    ...over,
  };
}

const list: AdminCustomer[] = [
  cust(),
  cust({
    id: "c2",
    name: "Ana Gómez",
    email: null,
    phone: null,
    city: "Oberá",
    tier: "gold",
    orders: 12,
    spent: 200000,
  }),
  cust({
    id: "m1",
    source: "manual",
    name: "Cliente de feria",
    email: "feria@mail.com",
    phone: "011 5555-1234",
    city: null,
    tier: "silver",
    orders: 0,
    spent: 0,
  }),
];

describe("filterAdminCustomers", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterAdminCustomers(list, {})).toHaveLength(3);
  });
  it("busca por nombre sin distinguir mayúsculas ni espacios de más", () => {
    expect(
      filterAdminCustomers(list, { q: "  ANA " }).map((c) => c.id),
    ).toEqual(["c2"]);
  });
  it("busca por email y por ciudad", () => {
    expect(
      filterAdminCustomers(list, { q: "feria@" }).map((c) => c.id),
    ).toEqual(["m1"]);
    expect(filterAdminCustomers(list, { q: "oberá" }).map((c) => c.id)).toEqual(
      ["c2"],
    );
  });
  it("busca por teléfono ignorando espacios y guiones", () => {
    expect(
      filterAdminCustomers(list, { q: "3757624148" }).map((c) => c.id),
    ).toEqual(["c1"]);
    expect(
      filterAdminCustomers(list, { q: "5555 1234" }).map((c) => c.id),
    ).toEqual(["m1"]);
  });
  it("con menos de 3 dígitos solo busca el texto literal, no los dígitos juntos", () => {
    // "76" aparece en 3757 62 sólo si se pegan los dígitos (3757 62 → 375762).
    expect(filterAdminCustomers(list, { q: "76" })).toHaveLength(0);
    expect(filterAdminCustomers(list, { q: "762" })).toHaveLength(1);
  });
  it("filtra por nivel y combina con la búsqueda", () => {
    expect(
      filterAdminCustomers(list, { tier: "gold" }).map((c) => c.id),
    ).toEqual(["c2"]);
    expect(filterAdminCustomers(list, { tier: "gold", q: "juan" })).toEqual([]);
  });
});

describe("customerCounts / tiersInfo", () => {
  it("cuenta por nivel sobre toda la lista", () => {
    expect(customerCounts(list)).toEqual({
      all: 3,
      gold: 1,
      silver: 1,
      bronze: 1,
    });
  });
  it("expone los umbrales reales de tier.ts", () => {
    const t = tiersInfo();
    expect(t.gold).toEqual({ label: "VIP", minSpent: 150000, minOrders: 10 });
    expect(t.silver.label).toBe("Frecuente");
    expect(t.bronze.minSpent).toBe(0);
  });
});

describe("customerToJson / customerDetailToJson", () => {
  it("serializa fechas ISO y la etiqueta del nivel", () => {
    const j = customerToJson(cust({ tier: "gold" }));
    expect(j.since).toBe("2026-03-01T12:00:00.000Z");
    expect(j.tierLabel).toBe("VIP");
    expect(j.spent).toBe(30000);
  });
  it("el detalle pasa montos a número y fechas a ISO", () => {
    const j = customerDetailToJson({
      customer: cust(),
      orders: [
        {
          id: "o1",
          orderNumber: "HF-0042",
          status: "delivered",
          total: "57500.00",
          createdAt: new Date("2026-10-01T10:00:00Z"),
        },
      ],
      points: {
        balance: 120,
        earned: 200,
        redeemed: 80,
        redemptions: [
          {
            id: "p1",
            reason: "Canje: $2.000 · cupón PREMIO-AB12C",
            points: 80,
            createdAt: new Date("2026-10-02T10:00:00Z"),
          },
        ],
      },
    });
    expect(j.orders[0]).toEqual({
      id: "o1",
      orderNumber: "HF-0042",
      status: "delivered",
      total: 57500,
      createdAt: "2026-10-01T10:00:00.000Z",
    });
    expect(j.points.balance).toBe(120);
    expect(j.points.redemptions[0]?.createdAt).toBe("2026-10-02T10:00:00.000Z");
  });
});
