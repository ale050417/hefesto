import { describe, it, expect } from "vitest";
import { colorUnitPrice } from "./pricing";

describe("colorUnitPrice (precio por color, modo color único)", () => {
  it("cobra el precio EXACTO del color elegido (absoluto, no recargo)", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, "Dorado")).toBe(
      1300,
    );
  });

  it("un color más barato también manda (es absoluto)", () => {
    expect(colorUnitPrice(1000, "single", { Amarillo: 800 }, "Amarillo")).toBe(
      800,
    );
  });

  it("color sin precio propio → precio base (nunca 0 silencioso)", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, "Negro")).toBe(
      1000,
    );
  });

  it("un precio 0 cargado se ignora → base", () => {
    expect(colorUnitPrice(1000, "single", { Negro: 0 }, "Negro")).toBe(1000);
  });

  it("multicolor NO toca el precio (color_prices ahí son gramos)", () => {
    expect(
      colorUnitPrice(5000, "multi", { Rojo: 30, Azul: 20 }, "Rojo + Azul"),
    ).toBe(5000);
  });

  it("sin color elegido → base", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, null)).toBe(1000);
  });

  it("nunca devuelve negativo", () => {
    expect(colorUnitPrice(-10, "single", {}, null)).toBe(0);
  });
});
