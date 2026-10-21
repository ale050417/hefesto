import { describe, expect, it, vi } from "vitest";
import { generateProductImage } from "./cloudflare";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const input = {
  prompt: "test prompt",
  photo: Buffer.from("fake"),
  photoType: "image/png",
};
const creds = { accountId: "acc", token: "tok" };

describe("generateProductImage (Cloudflare Workers AI)", () => {
  it("sin credenciales no llama a la red: not_configured", async () => {
    const fetchMock = vi.fn();
    const r = await generateProductImage(input, {
      fetch: fetchMock,
      accountId: null,
      token: null,
    });
    expect(r).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda prompt y foto por multipart al modelo, con el token", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/black-forest-labs/flux-2-klein-9b",
      );
      expect((init.headers as Record<string, string>).authorization).toBe(
        "Bearer tok",
      );
      const form = init.body as FormData;
      expect(form.get("prompt")).toBe("test prompt");
      expect(form.get("input_image_0")).toBeInstanceOf(Blob);
      expect(form.get("width")).toBe("1024");
      return jsonResponse(200, {
        success: true,
        result: { image: PNG.toString("base64") },
      });
    });
    const r = await generateProductImage(input, {
      ...creds,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mimeType).toBe("image/png");
      expect(r.image.equals(PNG)).toBe(true);
    }
  });

  it("el código 3030 de Cloudflare es 'flagged' (personaje con derechos)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        success: false,
        errors: [
          {
            code: 3030,
            message:
              "AiError: Your output has been flagged. Please choose another prompt / input image combination",
          },
        ],
      }),
    );
    const r = await generateProductImage(input, {
      ...creds,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: false, code: "flagged" });
  });

  it("429 es 'quota'", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, { success: false, errors: [{ message: "limit" }] }),
    );
    const r = await generateProductImage(input, {
      ...creds,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: false, code: "quota" });
  });

  it("un 401 explica que revisen el token", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { success: false }));
    const r = await generateProductImage(input, {
      ...creds,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: false, code: "error" });
    if (!r.ok) expect(r.message).toMatch(/CLOUDFLARE_AI_TOKEN/);
  });

  it("si la red falla, error amable (no excepción)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const r = await generateProductImage(input, {
      ...creds,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r).toMatchObject({ ok: false, code: "error" });
  });

  it("acepta un modelo alternativo por deps", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/ai/run/@cf/black-forest-labs/flux-2-klein-4b");
      return new Response(new Uint8Array(PNG), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    const r = await generateProductImage(input, {
      ...creds,
      model: "@cf/black-forest-labs/flux-2-klein-4b",
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
  });
});
