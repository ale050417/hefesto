import { describe, expect, it } from "vitest";
import {
  buildProductImagePrompt,
  cleanSceneHint,
  normalizeForMatch,
  pickScene,
} from "./prompt";

describe("pickScene", () => {
  it("un vaso va a la barra de un bar", () => {
    expect(pickScene({ name: "Vaso Stormtrooper" })).toMatch(/bar counter/);
  });

  it("matchea sin importar acentos ni mayúsculas (categoría incluida)", () => {
    expect(pickScene({ name: "Luz de noche", category: "Lámparas" })).toMatch(
      /bedside table/,
    );
  });

  it("un Pokémon va a una escena de personaje", () => {
    expect(
      pickScene({ name: "Pokemon 004 - Charmander", category: "Pokémon" }),
    ).toMatch(/character's world/);
  });

  it("la categoría y la descripción también cuentan", () => {
    expect(
      pickScene({
        name: "Groot",
        category: "Decoración",
        description: "Maceta con forma de Groot para suculentas",
      }),
    ).toMatch(/plants/);
  });

  it("sin pistas, mesa de madera y fondo de estudio", () => {
    expect(pickScene({ name: "Pieza 42" })).toMatch(/dark wooden table/);
  });
});

describe("buildProductImagePrompt", () => {
  it("incluye nombre, categoría y la escena automática, pero NO los colores", () => {
    const p = buildProductImagePrompt({
      name: "Taza Mario",
      category: "Tazas",
      colors: ["Rojo", "Blanco"],
    });
    expect(p).toContain('product: "Taza Mario"');
    expect(p).toContain("category: Tazas");
    // Los colores de venta recoloreaban la pieza: el prompt pide respetar
    // los de la foto.
    expect(p).not.toContain("Rojo");
    expect(p).toMatch(/exact colors seen in the photo/);
    expect(p).toMatch(/Scene: on a wooden bar counter/);
    expect(p).toMatch(/Keep the exact same object/);
  });

  it("la pista del usuario pisa la escena automática", () => {
    const p = buildProductImagePrompt({
      name: "Taza Mario",
      scene: '  en una "biblioteca"\n antigua ',
    });
    expect(p).toMatch(/Scene: en una biblioteca antigua\./);
    expect(p).not.toMatch(/bar counter/);
  });

  it("omite la categoría cuando no hay", () => {
    const p = buildProductImagePrompt({ name: "Pieza" });
    expect(p).toContain('(product: "Pieza")');
  });
});

describe("helpers", () => {
  it("cleanSceneHint recorta y limpia", () => {
    expect(cleanSceneHint(null)).toBeNull();
    expect(cleanSceneHint("   ")).toBeNull();
    expect(cleanSceneHint("x".repeat(300))).toHaveLength(200);
  });

  it("normalizeForMatch saca acentos", () => {
    expect(normalizeForMatch("Lámpara Ñandú")).toBe("lampara nandu");
  });
});
