import { describe, it, expect } from "vitest";
import { colorUnitPrice, saleUnitPrice } from "./pricing";

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

// Espejo de la resolución del cobro online (orderService): la venta manual
// debe dar el MISMO número que la tienda para el mismo producto/tamaño/color.
describe("saleUnitPrice (venta manual con variante elegida)", () => {
  const variant = {
    price: 10000,
    colorPrices: { Morado: 12500 },
  };

  it("MATRIZ: manda la celda del color DENTRO del tamaño", () => {
    expect(
      saleUnitPrice({
        basePrice: 9999,
        colorMode: "single",
        productColorPrices: { Morado: 7777 }, // con variante NO se usa
        variant,
        color: "Morado",
      }),
    ).toBe(12500);
  });

  it("sin celda para el color → precio del TAMAÑO (no el del producto)", () => {
    expect(
      saleUnitPrice({
        basePrice: 9999,
        colorMode: "single",
        productColorPrices: { Azul: 7777 },
        variant,
        color: "Azul",
      }),
    ).toBe(10000);
  });

  it("variante sin precio propio → base", () => {
    expect(
      saleUnitPrice({
        basePrice: 9999,
        colorMode: "single",
        productColorPrices: {},
        variant: { price: null, colorPrices: {} },
        color: "Negro",
      }),
    ).toBe(9999);
  });

  it("multicolor: el colorPrices de la variante NO aplica (sin color elegido)", () => {
    expect(
      saleUnitPrice({
        basePrice: 5000,
        colorMode: "multi",
        productColorPrices: { Rojo: 30 }, // gramos, no precios
        variant: { price: 2814, colorPrices: {} },
        color: null,
      }),
    ).toBe(2814);
  });

  it("SIN variante → cae en colorUnitPrice (precio exacto del color)", () => {
    expect(
      saleUnitPrice({
        basePrice: 300,
        colorMode: "single",
        productColorPrices: { Arcoíris: 3000 },
        variant: null,
        color: "Arcoíris",
      }),
    ).toBe(3000);
  });

  it("sin variante ni color → base", () => {
    expect(
      saleUnitPrice({
        basePrice: 1000,
        colorMode: "single",
        productColorPrices: { Dorado: 1300 },
      }),
    ).toBe(1000);
  });
});
