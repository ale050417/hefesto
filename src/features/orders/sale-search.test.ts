import { describe, expect, it } from "vitest";
import { saleMatches, type SearchableSale } from "./sale-search";

const venta: SearchableSale = {
  customerName: "Nicolás Gómez",
  label: "Llavero Boca",
  ref: "HEF-1042",
  detail: "Llavero Boca · Azul + Amarillo",
  category: "Llaveros",
  colors: ["Azul", "Amarillo"],
};

describe("saleMatches (buscador del tablero de ventas)", () => {
  it("búsqueda vacía no filtra nada", () => {
    expect(saleMatches(venta, "")).toBe(true);
    expect(saleMatches(venta, "   ")).toBe(true);
  });

  it("encuentra por cliente ignorando acentos y mayúsculas", () => {
    expect(saleMatches(venta, "nicolas")).toBe(true);
    expect(saleMatches(venta, "GÓMEZ")).toBe(true);
  });

  it("encuentra por número de pedido, categoría y color", () => {
    expect(saleMatches(venta, "1042")).toBe(true);
    expect(saleMatches(venta, "llaveros")).toBe(true);
    expect(saleMatches(venta, "amarillo")).toBe(true);
  });

  it("varias palabras pueden caer en campos distintos", () => {
    // "nico" está en el cliente y "azul" en los colores: igual coincide.
    expect(saleMatches(venta, "nico azul")).toBe(true);
  });

  it("si una palabra no aparece en ningún campo, no coincide", () => {
    expect(saleMatches(venta, "nico verde")).toBe(false);
    expect(saleMatches(venta, "river")).toBe(false);
  });

  it("no rompe con campos vacíos o ausentes", () => {
    expect(saleMatches({}, "algo")).toBe(false);
    expect(saleMatches({ customerName: null, colors: undefined }, "")).toBe(
      true,
    );
  });
});
