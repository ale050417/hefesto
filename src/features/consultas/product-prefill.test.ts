import { describe, expect, it } from "vitest";
import type { ProductForSale } from "@/features/products/services/catalogService";
import { inquiryProduct, optionHasCost } from "./product-prefill";

function product(over: Partial<ProductForSale>): ProductForSale {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Trofeo taekwondo",
    price: 18000,
    material: "PLA",
    weightGrams: 140,
    printMinutes: 420,
    extrasCost: 0,
    colors: ["Dorado", " Negro "],
    colorMode: "single",
    colorPrices: {},
    variants: [],
    categoryName: "Trofeos",
    dimensions: " Alto: 20 cm ",
    productionTime: "5 días hábiles",
    ...over,
  };
}

describe("inquiryProduct", () => {
  it("producto sin tamaños: una sola opción con el precio y el costeo de la ficha", () => {
    const p = inquiryProduct(product({}));
    expect(p).toMatchObject({
      name: "Trofeo taekwondo",
      material: "PLA",
      dimensions: "Alto: 20 cm",
      deliveryTime: "5 días hábiles",
      colors: "Dorado, Negro",
    });
    expect(p.options).toEqual([
      { label: null, unitPrice: 18000, grams: 140, printMinutes: 420 },
    ]);
    expect(optionHasCost(p, p.options[0]!)).toBe(true);
  });

  it("con tamaños: cada uno con su precio y sus gramos", () => {
    const p = inquiryProduct(
      product({
        variants: [
          {
            label: "Chico",
            price: 12000,
            colorGrams: {},
            weightGrams: 80,
            colorPrices: {},
            extrasCost: null,
          },
          {
            label: "Grande",
            price: null,
            colorGrams: {},
            weightGrams: null,
            colorPrices: {},
            extrasCost: null,
          },
        ],
      }),
    );
    expect(p.options).toEqual([
      { label: "Chico", unitPrice: 12000, grams: 80, printMinutes: 420 },
      // Sin precio ni peso propio: los del producto.
      { label: "Grande", unitPrice: 18000, grams: 140, printMinutes: 420 },
    ]);
  });

  it("multicolor: los gramos son la suma por color y los colores salen de ahí", () => {
    const p = inquiryProduct(
      product({
        colorMode: "multi",
        colors: [],
        colorPrices: { Blanco: 30, Rojo: 12.5 },
      }),
    );
    expect(p.colors).toBe("Blanco, Rojo");
    expect(p.options[0]).toMatchObject({ unitPrice: 18000, grams: 42.5 });
  });

  it("ficha sin material ni gramos: se rellena el precio pero no alcanza para costear", () => {
    const sinMaterial = inquiryProduct(product({ material: " " }));
    expect(optionHasCost(sinMaterial, sinMaterial.options[0]!)).toBe(false);
    const sinDatos = inquiryProduct(
      product({ weightGrams: null, printMinutes: null, dimensions: null }),
    );
    expect(sinDatos.dimensions).toBeNull();
    expect(optionHasCost(sinDatos, sinDatos.options[0]!)).toBe(false);
  });
});
