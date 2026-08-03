import { describe, it, expect } from "vitest";
import { colorUnitPrice, priceRange, saleUnitPrice } from "./pricing";

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

describe("priceRange (precio de la tarjeta = el mínimo comprable)", () => {
  const base = {
    price: 1200,
    salePrice: null,
    colorMode: "single" as const,
    colors: [] as string[],
    colorPrices: {} as Record<string, number>,
    variants: [] as {
      price: number | null;
      colorPrices: Record<string, number>;
    }[],
  };

  it("producto simple: el precio es el precio, sin 'desde'", () => {
    expect(priceRange(base)).toEqual({ min: 1200, max: 1200, from: false });
  });

  it("BUG DEL CASCO: con tamaños más caros NO muestra la base fantasma", () => {
    // La base ($1.200) no la puede pagar nadie: al elegir tamaño se cobra el
    // precio del tamaño. La tarjeta tiene que arrancar en el más barato REAL.
    const r = priceRange({
      ...base,
      variants: [
        { price: 8000, colorPrices: {} },
        { price: 12000, colorPrices: {} },
      ],
    });
    expect(r.min).toBe(8000);
    expect(r.max).toBe(12000);
    expect(r.from).toBe(true);
  });

  it("tamaños todos al mismo precio → sin 'desde' (sería ruido)", () => {
    const r = priceRange({
      ...base,
      variants: [
        { price: 5000, colorPrices: {} },
        { price: 5000, colorPrices: {} },
      ],
    });
    expect(r).toEqual({ min: 5000, max: 5000, from: false });
  });

  it("tamaño sin precio propio → hereda la base", () => {
    const r = priceRange({
      ...base,
      variants: [
        { price: null, colorPrices: {} },
        { price: 3000, colorPrices: {} },
      ],
    });
    expect(r).toEqual({ min: 1200, max: 3000, from: true });
  });

  it("precio por color sin tamaños: manda el color más barato", () => {
    const r = priceRange({
      ...base,
      price: 300,
      colors: ["Amarillo", "Arcoíris"],
      colorPrices: { Amarillo: 300, Arcoíris: 3000 },
    });
    expect(r).toEqual({ min: 300, max: 3000, from: true });
  });

  it("un color más barato que la base también baja el mínimo", () => {
    const r = priceRange({
      ...base,
      price: 1000,
      colors: ["Negro", "Dorado"],
      colorPrices: { Negro: 800, Dorado: 1300 },
    });
    expect(r).toEqual({ min: 800, max: 1300, from: true });
  });

  it("matriz tamaño × color: recorre TODAS las combinaciones", () => {
    const r = priceRange({
      ...base,
      price: 1000,
      colors: ["Azul", "Morado"],
      colorPrices: {},
      variants: [
        { price: 2000, colorPrices: { Morado: 2500 } }, // Azul 2000, Morado 2500
        { price: 4000, colorPrices: { Morado: 4500 } }, // Azul 4000, Morado 4500
      ],
    });
    expect(r).toEqual({ min: 2000, max: 4500, from: true });
  });

  it("la oferta baja el mínimo cuando NO hay tamaños con precio propio", () => {
    expect(priceRange({ ...base, price: 2000, salePrice: 1500 }).min).toBe(
      1500,
    );
  });

  it("con tamaños con precio propio la oferta NO aplica (y no debe mentir)", () => {
    const r = priceRange({
      ...base,
      price: 2000,
      salePrice: 1500,
      variants: [{ price: 9000, colorPrices: {} }],
    });
    expect(r.min).toBe(9000); // ni 1500 ni 2000: se cobra el tamaño
  });

  it("multicolor: color_prices son GRAMOS, no tocan el precio", () => {
    const r = priceRange({
      ...base,
      price: 5000,
      colorMode: "multi",
      colors: ["Rojo", "Azul"],
      colorPrices: { Rojo: 30, Azul: 20 },
    });
    expect(r).toEqual({ min: 5000, max: 5000, from: false });
  });
});
