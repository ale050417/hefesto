import { describe, it, expect } from "vitest";
import { NEW_PRODUCT_DAYS, isNewProduct, newSince } from "./new-product";

const HOY = new Date("2026-08-03T12:00:00Z");
const diasAtras = (d: number) =>
  new Date(HOY.getTime() - d * 24 * 60 * 60 * 1000);

describe("isNewProduct (el cartel 'Nuevo' se calcula por fecha)", () => {
  it("recién publicado → es nuevo", () => {
    expect(isNewProduct(HOY, HOY)).toBe(true);
  });

  it("de ayer → sigue siendo nuevo", () => {
    expect(isNewProduct(diasAtras(1), HOY)).toBe(true);
  });

  it(`justo en el límite (${NEW_PRODUCT_DAYS} días) → todavía es nuevo`, () => {
    expect(isNewProduct(diasAtras(NEW_PRODUCT_DAYS), HOY)).toBe(true);
  });

  it("un día después del límite → deja de ser nuevo SOLO", () => {
    expect(isNewProduct(diasAtras(NEW_PRODUCT_DAYS + 1), HOY)).toBe(false);
  });

  it("un producto de hace seis meses NO dice 'Nuevo' (el bug de antes)", () => {
    expect(isNewProduct(diasAtras(180), HOY)).toBe(false);
  });

  it("acepta la fecha como texto (viene así de la base)", () => {
    expect(isNewProduct(diasAtras(2).toISOString(), HOY)).toBe(true);
  });

  it("una fecha inválida no rompe: no es nuevo", () => {
    expect(isNewProduct("cualquier cosa", HOY)).toBe(false);
  });

  it("newSince devuelve el corte exacto para filtrar en SQL", () => {
    expect(newSince(HOY).toISOString()).toBe(
      diasAtras(NEW_PRODUCT_DAYS).toISOString(),
    );
  });
});
