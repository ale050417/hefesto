import { describe, expect, it, vi } from "vitest";
import { availableAiImageEngines, parseAiImageEngine } from "./engines";
import { generateProductImageWithGemini } from "./gemini";

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
const KEY = "clave-secreta-de-prueba";

async function run(fetchMock: unknown, model?: string) {
  return generateProductImageWithGemini(input, {
    apiKey: KEY,
    model,
    fetch: fetchMock as typeof fetch,
  });
}

describe("generateProductImageWithGemini", () => {
  it("sin clave no llama a la red: not_configured", async () => {
    const fetchMock = vi.fn();
    const r = await generateProductImageWithGemini(input, {
      fetch: fetchMock,
      apiKey: "",
    });
    expect(r).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda prompt + foto en base64 y pide imagen cuadrada; la clave va en el header", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1/models/gemini-nano-banana-2.1:generateContent",
      );
      expect(url).not.toContain(KEY);
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
        KEY,
      );
      const body = JSON.parse(init.body as string);
      expect(body.contents[0].parts[0]).toEqual({ text: "test prompt" });
      expect(body.contents[0].parts[1]).toEqual({
        inline_data: {
          mime_type: "image/png",
          data: Buffer.from("fake").toString("base64"),
        },
      });
      expect(body.generationConfig.responseModalities).toContain("IMAGE");
      expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: "1:1" });
      return jsonResponse(200, {
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { text: "Listo." },
                // Un boceto "pensado" no es la imagen final.
                {
                  thought: true,
                  inlineData: { mimeType: "image/png", data: "AAAA" },
                },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: PNG.toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      });
    });
    const r = await run(fetchMock);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mimeType).toBe("image/png");
      expect(r.image.equals(PNG)).toBe(true);
    }
  });

  it("cuota 0 del plan gratis (respuesta real del 2026-11-17): lo dice claro", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message:
            "You exceeded your current quota, please check your plan and billing details. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-nano-banana-2.1\nPlease retry in 7h44m3s.",
        },
      }),
    );
    const r = await run(fetchMock);
    expect(r).toMatchObject({ ok: false, code: "quota" });
    if (!r.ok) {
      expect(r.message).toMatch(/plan gratis de la clave de Gemini no incluye/);
      expect(r.message).not.toContain(KEY);
    }
  });

  it("un 429 de una cuenta paga es límite momentáneo, no 'plan gratis'", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message:
            "You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generate_content_paid_tier_requests, limit: 10",
        },
      }),
    );
    const r = await run(fetchMock);
    expect(r).toMatchObject({ ok: false, code: "quota" });
    if (!r.ok) expect(r.message).not.toMatch(/plan gratis/);
  });

  it("proyecto sin facturación (400/403 que habla de billing): mismo aviso", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        error: {
          code: 400,
          status: "FAILED_PRECONDITION",
          message: "Billing must be enabled for this model.",
        },
      }),
    );
    const r = await run(fetchMock);
    expect(r).toMatchObject({ ok: false, code: "quota" });
    if (!r.ok) expect(r.message).toMatch(/plan gratis/);
  });

  it("404: el modelo se dio de baja, hay que tocar GEMINI_IMAGE_MODEL", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/models/modelo-viejo:generateContent");
      return jsonResponse(404, {
        error: { code: 404, status: "NOT_FOUND", message: "not found" },
      });
    });
    const r = await run(fetchMock, "modelo-viejo");
    expect(r).toMatchObject({ ok: false, code: "error" });
    if (!r.ok) expect(r.message).toMatch(/GEMINI_IMAGE_MODEL/);
  });

  it("clave rechazada: avisa que revisen GEMINI_API_KEY, sin mostrarla", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(403, {
        error: { code: 403, status: "PERMISSION_DENIED", message: "denied" },
      }),
    );
    const r = await run(fetchMock);
    expect(r).toMatchObject({ ok: false, code: "error" });
    if (!r.ok) {
      expect(r.message).toMatch(/GEMINI_API_KEY/);
      expect(r.message).not.toContain(KEY);
    }
  });

  it("200 sin imagen por el filtro de contenido es 'flagged'", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }],
      }),
    );
    expect(await run(fetchMock)).toMatchObject({ ok: false, code: "flagged" });
  });

  it("200 con solo texto es un error común", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "No puedo." }] } },
        ],
      }),
    );
    expect(await run(fetchMock)).toMatchObject({ ok: false, code: "error" });
  });

  it("si la red falla, error amable (no excepción)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect(await run(fetchMock)).toMatchObject({ ok: false, code: "error" });
  });
});

describe("motores disponibles", () => {
  it("Gemini solo se ofrece con clave, y nunca es el primero (el default)", () => {
    expect(
      availableAiImageEngines({ cloudflare: true, gemini: false }).map(
        (e) => e.id,
      ),
    ).toEqual(["cloudflare"]);
    expect(
      availableAiImageEngines({ cloudflare: true, gemini: true }).map(
        (e) => e.id,
      ),
    ).toEqual(["cloudflare", "gemini"]);
    expect(
      availableAiImageEngines({ cloudflare: false, gemini: false }),
    ).toEqual([]);
  });

  it("parseAiImageEngine descarta lo desconocido", () => {
    expect(parseAiImageEngine("gemini")).toBe("gemini");
    expect(parseAiImageEngine("dall-e")).toBeNull();
  });
});
