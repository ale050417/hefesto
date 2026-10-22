import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUOTE_DEFAULTS,
  buildQuoteText,
  dimensionLines,
  pricesFromProduct,
} from "./build-quote";

describe("buildQuoteText", () => {
  it("arma el formato de referencia completo (llavero con escalón por cantidad)", () => {
    const text = buildQuoteText(
      {
        product: "Llavero APL",
        dimensions: ["Ancho: 5cm x 4cm", "Grosor: 2mm"],
        prices: [
          { label: "Precio (Por unidad)", amount: 2500, suffix: "c/u" },
          {
            label: "Precio (A partir de 10 unidades)",
            amount: 1200,
            suffix: "c/u",
          },
        ],
        colors: ["Blanco", "Verde Olivo", "Verde Militar"],
        depositPct: 50,
        depositText: DEFAULT_QUOTE_DEFAULTS.depositText,
        notes: DEFAULT_QUOTE_DEFAULTS.notes,
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(text).toBe(
      [
        "📦 COTIZACIÓN — HEFESTO 3D",
        "",
        "PRODUCTO : Llavero APL",
        "",
        "📐 DIMENSIONES APROXIMADAS",
        "* Ancho: 5cm x 4cm",
        "* Grosor: 2mm",
        "",
        "💰 PRECIO",
        "* Precio (Por unidad): $ 2.500 c/u",
        "* Precio (A partir de 10 unidades): $ 1.200 c/u",
        "",
        "COLORES CON SIMILITUD:",
        "* Blanco",
        "* Verde Olivo",
        "* Verde Militar",
        "",
        "💸 SEÑA: 50%",
        "La seña es necesaria para confirmar el encargo y comenzar con el trabajo.",
        "",
        "📝 ACLARACIÓN:",
        "",
        "📌 Las dimensiones y el precio indicados corresponden a la cotización realizada y pueden variar si se modifica el diseño, tamaño, cantidad o características de la pieza.",
      ].join("\n"),
    );
  });

  it("usa la nota de medidas cuando van en la imagen y omite secciones vacías", () => {
    const text = buildQuoteText(
      {
        product: "Gafas de ciclope | X-men",
        dimensions: [],
        dimensionsNote: "En la imagen adjuntada.",
        prices: [{ label: "Precio", amount: 16000 }],
        colors: [],
        depositPct: null,
        depositText: "",
        notes: [],
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(text).toContain(
      "📐 DIMENSIONES APROXIMADAS\nEn la imagen adjuntada.",
    );
    expect(text).toContain("* Precio: $ 16.000");
    expect(text).not.toContain("COLORES");
    expect(text).not.toContain("SEÑA");
    expect(text).not.toContain("ACLARACIÓN");
  });

  it("agrega el texto libre al final de la aclaración", () => {
    const text = buildQuoteText(
      {
        product: "X",
        dimensions: [],
        prices: [],
        colors: [],
        depositPct: 30,
        depositText: "Seña para empezar.",
        notes: ["Nota uno"],
        extra: "Entrega en 5 días.",
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(text).toContain("💸 SEÑA: 30%\nSeña para empezar.");
    expect(text.endsWith("📌 Nota uno\n\nEntrega en 5 días.")).toBe(true);
  });
});

describe("dimensionLines", () => {
  it("separa medidas por coma y nombra la medida suelta", () => {
    expect(dimensionLines("Alto: 9 cm, Ancho: 5 cm")).toEqual([
      "Alto: 9 cm",
      "Ancho: 5 cm",
    ]);
    expect(dimensionLines("10 × 8 × 12 cm")).toEqual([
      "Medidas: 10 × 8 × 12 cm",
    ]);
    expect(dimensionLines("")).toEqual([]);
  });
});

describe("pricesFromProduct", () => {
  it("prefiere tamaños, después colores, después el precio base (con oferta)", () => {
    expect(
      pricesFromProduct({
        price: 1000,
        variants: [
          { label: "Chico", price: 800 },
          { label: "Grande", price: 1500 },
        ],
      }),
    ).toEqual([
      { label: "Precio (Chico)", amount: 800 },
      { label: "Precio (Grande)", amount: 1500 },
    ]);
    expect(
      pricesFromProduct({
        price: 1000,
        colorPrices: { Rojo: 1000, Dorado: 1300 },
      }),
    ).toEqual([
      { label: "Precio (Rojo)", amount: 1000 },
      { label: "Precio (Dorado)", amount: 1300 },
    ]);
    expect(pricesFromProduct({ price: 1000, salePrice: 900 })).toEqual([
      { label: "Precio", amount: 900 },
    ]);
    expect(pricesFromProduct({ price: 0 })).toEqual([]);
  });
});
