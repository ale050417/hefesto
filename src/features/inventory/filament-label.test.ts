import { describe, expect, it } from "vitest";
import { filamentTag } from "./filament-label";

describe("filamentTag (etiqueta del carrete en los selectores)", () => {
  it("incluye la marca: tres rojos del mismo material se distinguen", () => {
    const rojos = [
      { material: "PLA", color: "Rojo", brand: "Grilon3" },
      { material: "PLA", color: "Rojo", brand: "Print3D" },
      { material: "PLA", color: "Rojo", brand: "Genérico" },
    ].map(filamentTag);
    expect(rojos).toEqual([
      "PLA · Rojo · Grilon3",
      "PLA · Rojo · Print3D",
      "PLA · Rojo · Genérico",
    ]);
    expect(new Set(rojos).size).toBe(3);
  });

  it("sin marca no deja un separador colgado", () => {
    expect(filamentTag({ material: "PETG", color: "Negro" })).toBe(
      "PETG · Negro",
    );
    expect(filamentTag({ material: "PETG", color: "Negro", brand: "  " })).toBe(
      "PETG · Negro",
    );
    expect(filamentTag({ material: "PETG", color: "Negro", brand: null })).toBe(
      "PETG · Negro",
    );
  });
});
