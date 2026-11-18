import { describe, expect, it } from "vitest";
import {
  buildProductImagePrompt,
  cleanSceneHint,
  detectPieceType,
  normalizeForMatch,
  parsePieceType,
  pickScene,
  PIECE_TYPES,
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
    expect(p).toContain('Producto: "Taza Mario" (categoría: Tazas).');
    expect(p).toContain("Escenario: on a wooden bar counter");
    // Los colores de venta recoloreaban la pieza: no van al prompt.
    expect(p).not.toContain("Rojo");
  });

  it("usa el prompt base de Ale: 1000 × 1000, fidelidad y encuadre 50–65 %", () => {
    const p = buildProductImagePrompt({ name: "Pieza" });
    expect(p).toContain("1000 × 1000 píxeles");
    expect(p).toContain("exacto de 1000 × 1000");
    expect(p).toContain("réplica exacta del original");
    expect(p).toContain("entre el 50% y el 65%");
  });

  it("pieza y escenario van al principio, antes de las instrucciones", () => {
    const p = buildProductImagePrompt({ name: "Taza Mario" });
    expect(p.startsWith('Producto: "Taza Mario"')).toBe(true);
    expect(p.indexOf("Escenario:")).toBeLessThan(
      p.indexOf("Utiliza la imagen"),
    );
  });

  it("la pista del usuario pisa la escena automática", () => {
    const p = buildProductImagePrompt({
      name: "Taza Mario",
      scene: '  en una "biblioteca"\n antigua ',
    });
    expect(p).toMatch(/Escenario: en una biblioteca antigua\./);
    expect(p).not.toMatch(/bar counter/);
  });

  it("omite la categoría cuando no hay", () => {
    const p = buildProductImagePrompt({ name: "Pieza" });
    expect(p.startsWith('Producto: "Pieza". Escenario:')).toBe(true);
  });
});

// Tipo de pieza (pedido de Agustín, 2026-11-17): los llaveros salían mal
// porque el prompt daba por sentado una figura parada sobre una mesa.
describe("tipo de pieza en el prompt", () => {
  it("figura (o sin tipo) es el prompt de siempre, sin agregados", () => {
    const sinTipo = buildProductImagePrompt({ name: "Pokemon 004" });
    expect(
      buildProductImagePrompt({ name: "Pokemon 004", pieceType: "figura" }),
    ).toBe(sinTipo);
    expect(sinTipo).not.toContain("Tipo de pieza:");
    expect(sinTipo).toContain("Escenario: standing on a dark wooden table");
    expect(sinTipo).toContain("entre el 50% y el 65%");
  });

  it("llavero: acostado o colgando, macro, con la argolla y nunca parado", () => {
    const p = buildProductImagePrompt({
      name: "Llavero Pikachu",
      pieceType: "llavero",
    });
    expect(p).toContain("Tipo de pieza: llavero.");
    expect(p).toContain("apoyada de plano sobre la superficie");
    expect(p).toContain("colgando de su argolla");
    expect(p).toContain("Conserva la argolla o cadena metálica");
    expect(p).toContain("Nunca la pongas de pie");
    expect(p).toContain("no la conviertas en una estatua");
    // Primer plano: reemplaza el encuadre general en vez de contradecirlo.
    expect(p).toContain("toma macro en primer plano");
    expect(p).toContain("entre el 75% y el 85%");
    expect(p).not.toContain("entre el 50% y el 65%");
    expect(p).not.toContain("no debe ocupar todo el encuadre");
    // El resto del prompt base sigue igual.
    expect(p).toContain("exacto de 1000 × 1000");
    expect(p).toContain("réplica exacta del original");
    expect(p).not.toMatch(/Escenario: standing/);
  });

  it("llavero elegido a mano sobre un personaje: la escena no lo para", () => {
    const p = buildProductImagePrompt({
      name: "Pokemon 025 - Pikachu",
      pieceType: "llavero",
    });
    expect(p).toContain("Escenario: lying flat on a dark wooden surface");
    expect(p).not.toContain("standing");
  });

  it("chop / vaso: de pie, altura completa y sin tocar la funda", () => {
    const p = buildProductImagePrompt({
      name: "Chop Homero",
      pieceType: "chop",
    });
    expect(p).toContain("Tipo de pieza: chop o vaso");
    expect(p).toContain("de pie, en posición vertical");
    expect(p).toContain("toda su altura visible");
    expect(p).toContain("No cambies el diseño impreso de la funda");
    expect(p).toContain("entre el 50% y el 65%");
  });

  it("maceta / decoración: ambiente de hogar creíble", () => {
    const p = buildProductImagePrompt({
      name: "Maceta Groot",
      pieceType: "maceta",
    });
    expect(p).toContain("Tipo de pieza: maceta u objeto de decoración");
    expect(p).toContain("ambiente de hogar creíble");
    // Se combina con la escena automática, no la reemplaza.
    expect(p).toContain("Escenario: on a bright wooden shelf next to green");
  });

  it("pieza plana / cartel: de frente, apenas en ángulo, pared o escritorio", () => {
    const p = buildProductImagePrompt({
      name: "Cartel Barbería Tito",
      pieceType: "plana",
    });
    expect(p).toContain("Tipo de pieza: pieza plana (cartel, placa o logo)");
    expect(p).toContain("vista frontal, apenas en ángulo");
    expect(p).toContain("colgada en una pared o apoyada sobre un escritorio");
    expect(p).toContain("Escenario: mounted on a clean wall");
  });

  it("otro: neutro, conserva forma y proporciones", () => {
    const p = buildProductImagePrompt({ name: "Pieza 42", pieceType: "otro" });
    expect(p).toContain("Tipo de pieza: otro.");
    expect(p).toContain("la forma y las proporciones");
    expect(p).toContain("Toma de estudio neutra");
    expect(p).not.toContain("standing");
  });

  it("el tipo va arriba, antes de las instrucciones base", () => {
    const p = buildProductImagePrompt({
      name: "Llavero",
      pieceType: "llavero",
    });
    expect(p.startsWith('Producto: "Llavero". Escenario:')).toBe(true);
    expect(p.indexOf("Tipo de pieza:")).toBeLessThan(
      p.indexOf("Utiliza la imagen"),
    );
  });

  it("la pista de escena del usuario sigue mandando con cualquier tipo", () => {
    const p = buildProductImagePrompt({
      name: "Llavero",
      pieceType: "llavero",
      scene: "sobre una mochila",
    });
    expect(p).toContain("Escenario: sobre una mochila.");
    expect(p).toContain("Tipo de pieza: llavero.");
  });
});

describe("detectPieceType", () => {
  it.each([
    ["Llavero Pikachu", "llavero"],
    ["Chop Homero 500 ml", "chop"],
    ["Vaso Stormtrooper", "chop"],
    ["Mate Boca Juniors", "chop"],
    ["Maceta Groot", "maceta"],
    ["Cartel LED Barbería", "plana"],
    ["Logo de la empresa", "plana"],
    ["Placa de puerta", "plana"],
    ["Pokemon 004 - Charmander", "figura"],
    ["Pieza 42", "figura"],
  ] as const)("%s → %s", (name, expected) => {
    expect(detectPieceType({ name })).toBe(expected);
  });

  it("no depende de acentos ni mayúsculas, y mira la categoría", () => {
    expect(detectPieceType({ name: "Groot", category: "MACETAS" })).toBe(
      "maceta",
    );
    expect(detectPieceType({ name: "Pikachu", category: "Llaveros" })).toBe(
      "llavero",
    );
  });

  it("un llavero de un personaje es un llavero, no una figura", () => {
    expect(
      detectPieceType({ name: "Llavero figura Pokemon", category: "Pokémon" }),
    ).toBe("llavero");
  });

  it("la descripción solo cuenta si nombre y categoría no dicen nada", () => {
    expect(
      detectPieceType({ name: "Groot", description: "Maceta para suculentas" }),
    ).toBe("maceta");
    // "acabado mate" no convierte a una figura en un mate.
    expect(
      detectPieceType({
        name: "Figura Batman",
        description: "Negro con acabado mate",
      }),
    ).toBe("figura");
  });

  it("una figura en la categoría Decoración sigue siendo figura", () => {
    expect(
      detectPieceType({ name: "Figura Dragón", category: "Decoración" }),
    ).toBe("figura");
    expect(detectPieceType({ name: "Buda", category: "Decoración" })).toBe(
      "maceta",
    );
  });
});

describe("parsePieceType", () => {
  it("acepta solo los tipos conocidos", () => {
    expect(parsePieceType("llavero")).toBe("llavero");
    expect(parsePieceType("estatua")).toBeNull();
    expect(parsePieceType(null)).toBeNull();
  });

  it("hay un chip por cada tipo pedido", () => {
    expect(PIECE_TYPES.map((t) => t.label)).toEqual([
      "Figura",
      "Llavero",
      "Chop / vaso",
      "Maceta / decoración",
      "Pieza plana / cartel",
      "Otro",
    ]);
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
