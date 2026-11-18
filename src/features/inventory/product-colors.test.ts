import { describe, expect, it } from "vitest";
import { colorsWithFilament } from "./product-colors";

describe("colorsWithFilament", () => {
  const catalog = [
    { name: "Bronce", hex: "#ce8946" },
    { name: "Bronze", hex: "#ce8946" },
    { name: "Galaxia", hex: "#4b3a78" },
    { name: "Negro", hex: "#111111" },
  ];

  it("deja solo los colores que tienen filamento cargado", () => {
    expect(
      colorsWithFilament(catalog, ["Negro", "Bronce"]).map((c) => c.name),
    ).toEqual(["Bronce", "Negro"]);
  });

  it("compara sin importar mayúsculas ni espacios", () => {
    expect(
      colorsWithFilament(catalog, [" negro ", "GALAXIA"]).map((c) => c.name),
    ).toEqual(["Galaxia", "Negro"]);
  });

  it("sin filamentos no ofrece ninguno", () => {
    expect(colorsWithFilament(catalog, [])).toEqual([]);
  });
});
