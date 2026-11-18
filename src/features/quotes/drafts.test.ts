import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTE_DEFAULTS } from "./build-quote";
import { draftFromProduct } from "./drafts";

describe("draftFromProduct", () => {
  it("multicolor: los gramos por color NO salen como precios", () => {
    // Arreglo de Agustín (2026-11-17): al reabrir un producto multicolor la
    // cotización decía "Precio (Rojo): $ 49, Precio (Negro): $ 36…", que eran
    // los gramos de cada color.
    const draft = draftFromProduct(
      {
        name: "Pokemon Legendario | Groudon",
        price: 14300,
        colors: ["Rojo", "Negro", "Blanco"],
        colorMode: "multi",
        colorPrices: { Rojo: 49, Negro: 36, Blanco: 17 },
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(draft.prices).toEqual([{ label: "Precio", amount: 14300 }]);
    expect(draft.colors).toEqual(["Rojo", "Negro", "Blanco"]);
  });

  it("un color a elección: el precio propio de cada color sí se muestra", () => {
    const draft = draftFromProduct(
      {
        name: "Maceta",
        price: 1000,
        colorMode: "single",
        colorPrices: { Rojo: 1000, Dorado: 1300 },
      },
      DEFAULT_QUOTE_DEFAULTS,
    );
    expect(draft.prices).toEqual([
      { label: "Precio (Rojo)", amount: 1000 },
      { label: "Precio (Dorado)", amount: 1300 },
    ]);
  });
});
