import { describe, it, expect } from "vitest";
import { photoColorOptions } from "./photo-colors";

describe("photoColorOptions (a qué color puede corresponder una foto)", () => {
  it("color único: los colores del producto", () => {
    expect(
      photoColorOptions({
        colorMode: "single",
        colors: ["Rojo", "Negro"],
        variantLabels: ["15 cm", "25 cm"],
      }),
    ).toEqual(["Rojo", "Negro"]);
  });

  it("multicolor: las COMBINACIONES, no los colores sueltos", () => {
    expect(
      photoColorOptions({
        colorMode: "multi",
        colors: ["Rojo", "Negro", "Blanco"],
        variantLabels: ["Rojo + Negro", "Blanco + Negro"],
      }),
    ).toEqual(["Rojo + Negro", "Blanco + Negro"]);
  });

  it("multicolor con UNA sola combinación: no hay entre qué saltar", () => {
    expect(
      photoColorOptions({
        colorMode: "multi",
        colors: ["Rojo", "Negro"],
        variantLabels: ["Rojo + Negro"],
      }),
    ).toEqual([]);
  });

  it("multicolor: ignora los tamaños (no son combinaciones)", () => {
    expect(
      photoColorOptions({
        colorMode: "multi",
        colors: [],
        variantLabels: ["15 cm", "25 cm"],
      }),
    ).toEqual([]);
  });

  it("color único sin colores cargados → nada que elegir", () => {
    expect(
      photoColorOptions({
        colorMode: "single",
        colors: [],
        variantLabels: [],
      }),
    ).toEqual([]);
  });

  it("descarta colores vacíos (no ofrece una opción en blanco)", () => {
    expect(
      photoColorOptions({
        colorMode: "single",
        colors: ["Rojo", "  ", ""],
        variantLabels: [],
      }),
    ).toEqual(["Rojo"]);
  });

  // El bug real: el color se truncaba a 40 chars y dejaba de coincidir con la
  // etiqueta. Acá se comprueba que las combinaciones largas salen ENTERAS.
  it("no recorta las combinaciones largas", () => {
    const largo = "Negro + Rojo + Azul + Amarillo + Blanco + Verde";
    expect(largo.length).toBeGreaterThan(40);
    const r = photoColorOptions({
      colorMode: "multi",
      colors: [],
      variantLabels: [largo, "Rojo + Negro"],
    });
    expect(r).toContain(largo);
  });
});
