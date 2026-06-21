import { describe, expect, it } from "vitest";
import { computeAverage } from "./service";

describe("computeAverage", () => {
  it("promedia y redondea a 1 decimal", () => {
    expect(computeAverage([5, 4, 4])).toBe(4.3);
    expect(computeAverage([5, 5])).toBe(5);
  });
  it("0 si no hay reseñas", () => {
    expect(computeAverage([])).toBe(0);
  });
});
