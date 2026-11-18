import { describe, expect, it } from "vitest";
import { isSameSet, normalizePosition } from "./image-frame";

describe("normalizePosition", () => {
  it("acepta dos porcentajes y los redondea", () => {
    expect(normalizePosition("50% 30%")).toBe("50% 30%");
    expect(normalizePosition(" 12.6%   0% ")).toBe("13% 0%");
  });

  it("recorta lo que se pasa de 0–100", () => {
    expect(normalizePosition("140% -20%")).toBe("100% 0%");
  });

  it("rechaza lo que no es un encuadre", () => {
    expect(normalizePosition("center")).toBeNull();
    expect(normalizePosition("50%")).toBeNull();
    expect(normalizePosition("50% 50%; color:red")).toBeNull();
    expect(normalizePosition(50)).toBeNull();
  });
});

describe("isSameSet", () => {
  it("mismo conjunto en otro orden", () => {
    expect(isSameSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("falta, sobra o se repite uno", () => {
    expect(isSameSet(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isSameSet(["a", "b"], ["a", "b", "x"])).toBe(false);
    expect(isSameSet(["a", "b"], ["a", "a"])).toBe(false);
    expect(isSameSet(["a", "b"], ["a", "x"])).toBe(false);
  });
});
