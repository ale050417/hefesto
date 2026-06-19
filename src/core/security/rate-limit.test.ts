import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimit, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("permite hasta el límite y luego bloquea", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    const blocked = rateLimit("k", opts, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("reinicia al pasar la ventana", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 500).ok).toBe(false);
    expect(rateLimit("k", opts, 1000).ok).toBe(true);
  });

  it("aísla por clave", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
  });
});
