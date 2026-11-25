import { describe, expect, it } from "vitest";
import {
  choiceValueFor,
  filamentChoices,
  firstChoiceValue,
  type ChoiceFilament,
} from "./filament-choices";

const f = (
  id: string,
  color: string,
  typeId: string | null,
  typeName: string | null,
  costPerKg = 26000,
): ChoiceFilament => ({
  id,
  material: "PLA",
  color,
  brand: "Bambu Lab",
  costPerKg,
  typeId,
  typeName,
});

const LIST = [
  f("a", "Verde", "t-pla", "PLA"),
  f("b", "Azul", "t-pla", "PLA"),
  f("c", "Dorado", "t-silk", "PLA Silk (Dorado)", 34000),
  f("d", "Negro", null, null, 18000),
  f("e", "Negro", "t-petg", "PETG"),
];

describe("filamentChoices", () => {
  it("junta los carretes del mismo tipo en una sola opción", () => {
    const { types, loose } = filamentChoices(LIST);
    expect(types.map((t) => [t.name, t.costPerKg, t.spools])).toEqual([
      ["PETG", 26000, 1],
      ["PLA", 26000, 2],
      ["PLA Silk (Dorado)", 34000, 1],
    ]);
    expect(loose.map((x) => x.id)).toEqual(["d"]);
  });

  it("cada tipo viaja con el id de uno de sus carretes", () => {
    const pla = filamentChoices(LIST).types.find((t) => t.typeId === "t-pla");
    expect(pla?.value).toBe("a");
  });

  it("sin tipos cargados, todos los carretes quedan sueltos", () => {
    const list = [f("a", "Verde", null, null), f("b", "Azul", null, null)];
    expect(filamentChoices(list)).toEqual({ types: [], loose: list });
  });
});

describe("choiceValueFor", () => {
  it("un carrete con tipo cae en la opción de su tipo", () => {
    expect(choiceValueFor(LIST, "b")).toBe("a");
  });
  it("un carrete sin tipo se elige a sí mismo", () => {
    expect(choiceValueFor(LIST, "d")).toBe("d");
  });
  it("un carrete que ya no existe no elige nada", () => {
    expect(choiceValueFor(LIST, "zzz")).toBe("");
    expect(choiceValueFor(LIST, null)).toBe("");
  });
});

describe("firstChoiceValue", () => {
  it("arranca en el primer tipo", () => {
    expect(firstChoiceValue(LIST)).toBe("e");
  });
  it("sin tipos, en el primer carrete; sin nada, vacío", () => {
    expect(firstChoiceValue([f("x", "Rojo", null, null)])).toBe("x");
    expect(firstChoiceValue([])).toBe("");
  });
});
