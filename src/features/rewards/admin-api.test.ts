import { describe, expect, it } from "vitest";
import {
  programInfo,
  redemptionToJson,
  rewardInputProblem,
  rewardToJson,
  sortRewards,
} from "./admin-api";
import type { RewardInput } from "./schemas";
import type { Reward } from "./service";

function reward(over: Partial<Reward> = {}): Reward {
  return {
    id: "r1",
    type: "discount",
    title: "$2.000 de descuento",
    description: null,
    costPoints: 500,
    discountValue: "2000.00",
    discountIsPercent: false,
    productId: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  };
}

describe("rewardToJson", () => {
  it("convierte el numeric a número y trae la etiqueta del tipo", () => {
    const j = rewardToJson(reward());
    expect(j.discountValue).toBe(2000);
    expect(j.typeLabel).toBe("Descuento");
    expect(j.createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(j.productName).toBeNull();
  });
  it("resuelve el nombre del producto de regalo si está publicado", () => {
    const names = new Map([["p1", "Mate Mario"]]);
    const j = rewardToJson(
      reward({ type: "product", productId: "p1", discountValue: null }),
      names,
    );
    expect(j.productName).toBe("Mate Mario");
    expect(j.discountValue).toBeNull();
    expect(
      rewardToJson(reward({ type: "product", productId: "p2" }), names)
        .productName,
    ).toBeNull();
  });
});

describe("sortRewards", () => {
  it("de menor a mayor costo, sin mutar la entrada", () => {
    const input = [
      reward({ id: "a", costPoints: 900 }),
      reward({ id: "b", costPoints: 100 }),
      reward({ id: "c", costPoints: 500 }),
    ];
    expect(sortRewards(input).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("rewardInputProblem", () => {
  const base: RewardInput = {
    type: "shipping",
    title: "Envío",
    costPoints: 300,
  };
  it("envío gratis no necesita nada más", () => {
    expect(rewardInputProblem(base)).toBeNull();
  });
  it("descuento sin valor es un problema", () => {
    expect(rewardInputProblem({ ...base, type: "discount" })).toBe(
      "Ingresá el valor del descuento.",
    );
    expect(
      rewardInputProblem({ ...base, type: "discount", discountValue: 15 }),
    ).toBeNull();
  });
  it("producto sin producto es un problema", () => {
    expect(rewardInputProblem({ ...base, type: "product" })).toBe(
      "Elegí el producto de regalo.",
    );
    expect(
      rewardInputProblem({
        ...base,
        type: "product",
        productId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBeNull();
  });
});

describe("programInfo / redemptionToJson", () => {
  it("expone las reglas reales de points.ts", () => {
    expect(programInfo()).toEqual({ pointsPerAmount: 100, moneyPerPoint: 1 });
  });
  it("serializa un canje", () => {
    expect(
      redemptionToJson({
        id: "t1",
        customerId: "c1",
        customerName: null,
        reason: "Canje: Envío gratis",
        points: 300,
        createdAt: new Date("2026-10-10T10:00:00Z"),
      }),
    ).toEqual({
      id: "t1",
      customerId: "c1",
      customerName: null,
      reason: "Canje: Envío gratis",
      points: 300,
      createdAt: "2026-10-10T10:00:00.000Z",
    });
  });
});
