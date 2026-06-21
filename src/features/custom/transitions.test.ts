import { describe, expect, it } from "vitest";
import { canTransitionCustom } from "./transitions";

describe("canTransitionCustom", () => {
  it("flujo válido", () => {
    expect(canTransitionCustom("pending", "quoted")).toBe(true);
    expect(canTransitionCustom("quoted", "approved")).toBe(true);
    expect(canTransitionCustom("approved", "in_production")).toBe(true);
    expect(canTransitionCustom("in_production", "done")).toBe(true);
  });
  it("rechaza saltos y terminales", () => {
    expect(canTransitionCustom("pending", "approved")).toBe(false);
    expect(canTransitionCustom("done", "in_production")).toBe(false);
    expect(canTransitionCustom("rejected", "quoted")).toBe(false);
  });
});
