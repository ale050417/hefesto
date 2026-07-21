import { describe, it, expect } from "vitest";
import { colorUnitPrice } from "./pricing";

describe("colorUnitPrice", () => {
  it("color con precio propio = precio EXACTO (absoluto), pisa la base", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, "Dorado")).toBe(
      1300,
    );
  });

  it("un color más barato que la base también manda (es absoluto, no ajuste)", () => {
    expect(colorUnitPrice(1000, "single", { Negro: 800 }, "Negro")).toBe(800);
  });

  it("color sin precio propio → cobra la base (nunca 0)", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, "Negro")).toBe(
      1000,
    );
  });

  it("precio 0 cargado para un color se ignora → base (nunca 0 silencioso)", () => {
    expect(colorUnitPrice(1000, "single", { Negro: 0 }, "Negro")).toBe(1000);
  });

  it("multicolor no toca el precio (la pieza ya trae su suma)", () => {
    expect(
      colorUnitPrice(5500, "multi", { Rojo: 3500, Azul: 2000 }, "Rojo + Azul"),
    ).toBe(5500);
  });

  it("sin color elegido → base", () => {
    expect(colorUnitPrice(1000, "single", { Dorado: 1300 }, null)).toBe(1000);
  });
});
