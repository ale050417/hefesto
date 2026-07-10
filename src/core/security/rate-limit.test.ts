import { describe, expect, it, vi } from "vitest";
import {
  applyHit,
  rateLimit,
  toResult,
  type RateLimitDeps,
  type RateLimitHit,
} from "./rate-limit";

// El reducer puro es el CONTRATO que replica la sentencia SQL (ON CONFLICT).
describe("applyHit (ventana fija)", () => {
  it("primer hit abre la ventana", () => {
    expect(applyHit(null, 0, 1000)).toEqual({ count: 1, resetAtMs: 1000 });
  });

  it("dentro de la ventana incrementa y conserva el vencimiento", () => {
    expect(applyHit({ count: 1, resetAtMs: 1000 }, 500, 1000)).toEqual({
      count: 2,
      resetAtMs: 1000,
    });
  });

  it("con la ventana vencida reinicia el contador", () => {
    expect(applyHit({ count: 9, resetAtMs: 1000 }, 1000, 1000)).toEqual({
      count: 1,
      resetAtMs: 2000,
    });
  });
});

describe("toResult", () => {
  it("permite hasta el límite y luego bloquea con retryAfter", () => {
    expect(toResult({ count: 3, resetAtMs: 1000 }, 3, 0)).toEqual({
      ok: true,
      remaining: 0,
      retryAfterMs: 0,
    });
    expect(toResult({ count: 4, resetAtMs: 1000 }, 3, 200)).toEqual({
      ok: false,
      remaining: 0,
      retryAfterMs: 800,
    });
  });

  it("informa los intentos restantes", () => {
    expect(toResult({ count: 1, resetAtMs: 1000 }, 5, 0).remaining).toBe(4);
  });
});

// Store falso EN MEMORIA construido sobre el mismo reducer: valida la
// integración key→contador→resultado sin base real.
function makeStore(): RateLimitDeps {
  const rows = new Map<string, RateLimitHit>();
  return {
    hit: async (key, windowMs) => {
      const next = applyHit(rows.get(key) ?? null, Date.now(), windowMs);
      rows.set(key, next);
      return next;
    },
  };
}

describe("rateLimit (store inyectado)", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const deps = makeStore();
    const opts = { limit: 3, windowMs: 60_000 };
    expect((await rateLimit("k", opts, deps)).ok).toBe(true);
    expect((await rateLimit("k", opts, deps)).ok).toBe(true);
    expect((await rateLimit("k", opts, deps)).ok).toBe(true);
    const blocked = await rateLimit("k", opts, deps);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("aísla por clave", async () => {
    const deps = makeStore();
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await rateLimit("a", opts, deps)).ok).toBe(true);
    expect((await rateLimit("b", opts, deps)).ok).toBe(true);
  });

  it("FAIL-OPEN: si el store falla, permite y NO lanza", async () => {
    const deps: RateLimitDeps = {
      hit: vi.fn(async () => {
        throw new Error("DB caída");
      }),
    };
    const res = await rateLimit("k", { limit: 1, windowMs: 1000 }, deps);
    expect(res.ok).toBe(true);
  });
});
