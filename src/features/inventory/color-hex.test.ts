import { describe, expect, it } from "vitest";
import { buildHexResolver } from "./color-hex";

describe("buildHexResolver", () => {
  const resolve = buildHexResolver([
    { name: "Verde militar", hex: "#4B5320" },
    { name: "Negro", hex: "#000000" },
    { name: "Sin hex", hex: null },
  ]);

  it("prefiere el hex del catálogo (colores personalizados)", () => {
    expect(resolve("Verde militar")).toBe("#4B5320");
    // El catálogo pisa al nombre conocido.
    expect(resolve("Negro")).toBe("#000000");
  });

  it("es insensible a mayúsculas y espacios", () => {
    expect(resolve("  verde MILITAR ")).toBe("#4B5320");
  });

  it("cae a los nombres conocidos", () => {
    expect(resolve("Dorado")).toBe("#C9A84C");
  });

  it("desconocido, vacío o sin hex → null", () => {
    expect(resolve("Fucsia")).toBeNull();
    expect(resolve("Sin hex")).toBeNull();
    expect(resolve("")).toBeNull();
    expect(resolve(null)).toBeNull();
  });
});
