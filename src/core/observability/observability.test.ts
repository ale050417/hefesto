import { afterEach, describe, expect, it, vi } from "vitest";
import { captureException, captureMessage } from "./index";

describe("observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captureException loguea sin relanzar", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      captureException(new Error("boom"), { boundary: "test" }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("captureMessage loguea como warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    captureMessage("algo notable");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
