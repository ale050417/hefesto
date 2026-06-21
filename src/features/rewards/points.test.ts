import { describe, expect, it } from "vitest";
import { canRedeem, computePointsEarned, pointsToMoney } from "./points";

describe("computePointsEarned", () => {
  it("1 punto cada $100, redondeando para abajo", () => {
    expect(computePointsEarned(0)).toBe(0);
    expect(computePointsEarned(99)).toBe(0);
    expect(computePointsEarned(100)).toBe(1);
    expect(computePointsEarned(1599)).toBe(15);
  });
  it("ignora valores inválidos", () => {
    expect(computePointsEarned(-50)).toBe(0);
    expect(computePointsEarned(Number.NaN)).toBe(0);
  });
});

describe("pointsToMoney", () => {
  it("convierte puntos a pesos", () => {
    expect(pointsToMoney(0)).toBe(0);
    expect(pointsToMoney(120)).toBe(120);
    expect(pointsToMoney(-5)).toBe(0);
  });
});

describe("canRedeem", () => {
  it("solo permite canjear puntos enteros disponibles", () => {
    expect(canRedeem(100, 50)).toBe(true);
    expect(canRedeem(100, 100)).toBe(true);
    expect(canRedeem(100, 101)).toBe(false);
    expect(canRedeem(100, 0)).toBe(false);
    expect(canRedeem(100, 2.5)).toBe(false);
  });
});
