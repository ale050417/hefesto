import { describe, expect, it } from "vitest";
import { fetchWithTimeout } from "./fetch-with-timeout";

/** fetch falso que nunca responde: solo rechaza si lo abortan. */
const neverResolves: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(init.signal?.reason ?? new Error("aborted")),
    );
  });

describe("fetchWithTimeout", () => {
  it("aborta con TimeoutError un fetch que nunca responde", async () => {
    const f = fetchWithTimeout(25, neverResolves);
    await expect(f("https://example.test")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("devuelve la respuesta cuando llega a tiempo", async () => {
    const okFetch: typeof fetch = async () => new Response("ok");
    const f = fetchWithTimeout(1_000, okFetch);
    const res = await f("https://example.test");
    expect(await res.text()).toBe("ok");
  });

  it("respeta un abort externo aunque el timeout no haya vencido", async () => {
    const f = fetchWithTimeout(60_000, neverResolves);
    const ctrl = new AbortController();
    const promise = f("https://example.test", { signal: ctrl.signal });
    ctrl.abort(new Error("abort-externo"));
    await expect(promise).rejects.toThrow("abort-externo");
  });
});
