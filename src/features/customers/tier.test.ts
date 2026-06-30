import { describe, expect, it } from "vitest";
import { computeTier } from "./tier";

describe("computeTier (categoría del cliente)", () => {
  it("VIP (gold) por gasto alto o muchos pedidos", () => {
    expect(computeTier(150_000, 0)).toBe("gold");
    expect(computeTier(0, 10)).toBe("gold");
    expect(computeTier(500_000, 25)).toBe("gold");
  });
  it("Frecuente (silver) en el rango medio", () => {
    expect(computeTier(40_000, 0)).toBe("silver");
    expect(computeTier(0, 3)).toBe("silver");
    expect(computeTier(149_999, 9)).toBe("silver");
  });
  it("Nuevo (bronze) por defecto", () => {
    expect(computeTier(0, 0)).toBe("bronze");
    expect(computeTier(39_999, 2)).toBe("bronze");
  });
});
