import { describe, expect, it } from "vitest";
import { ValidationError } from "@/core/errors";
import { planWeigh } from "./weigh";

describe("planWeigh · calcular filamento pesando el carrete", () => {
  it("el ejemplo de Agustín: 680 g − 250 g de carrete = 430 g", () => {
    expect(
      planWeigh({ totalGrams: 680, emptyGrams: 250, spoolGrams: 1000 }),
    ).toEqual({ remainingGrams: 430, newStockGrams: 430 });
  });

  it("suma enteros los carretes cerrados del mismo color", () => {
    expect(
      planWeigh({
        totalGrams: 680,
        emptyGrams: 250,
        sealedSpools: 2,
        spoolGrams: 1000,
      }),
    ).toEqual({ remainingGrams: 430, newStockGrams: 2430 });
  });

  it("un carrete que pesa lo mismo que vacío queda en 0", () => {
    expect(
      planWeigh({ totalGrams: 250, emptyGrams: 250, spoolGrams: 1000 }),
    ).toEqual({ remainingGrams: 0, newStockGrams: 0 });
  });

  it("redondea a 2 decimales", () => {
    expect(
      planWeigh({ totalGrams: 400.555, emptyGrams: 172.3, spoolGrams: 1000 })
        .remainingGrams,
    ).toBe(228.26);
  });

  it("rechaza un peso menor al del carrete vacío", () => {
    expect(() =>
      planWeigh({ totalGrams: 200, emptyGrams: 250, spoolGrams: 1000 }),
    ).toThrow(ValidationError);
  });

  it("rechaza un peso vacío o inválido", () => {
    for (const totalGrams of [0, -5, Number.NaN]) {
      expect(() =>
        planWeigh({ totalGrams, emptyGrams: 250, spoolGrams: 1000 }),
      ).toThrow("Ingresá cuánto pesa el carrete.");
    }
  });

  it("ignora carretes cerrados negativos o con decimales raros", () => {
    expect(
      planWeigh({
        totalGrams: 680,
        emptyGrams: 250,
        sealedSpools: -3,
        spoolGrams: 1000,
      }).newStockGrams,
    ).toBe(430);
    expect(
      planWeigh({
        totalGrams: 680,
        emptyGrams: 250,
        sealedSpools: 1.9,
        spoolGrams: 1000,
      }).newStockGrams,
    ).toBe(1430);
  });
});
