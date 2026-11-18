import { env } from "@/core/config/env";
import { mimeOf, type AiImageResult } from "./cloudflare";

/**
 * Segundo motor de la foto de producto con IA: el modelo de imagen de Gemini
 * por la API de Google (pedido de Agustín, 2026-11-17: "tener dos opciones").
 * Es OPCIONAL y nunca el motor por defecto: Google cobra cada imagen y el
 * plan gratis de la clave no las incluye. Probado el 2026-10-21 y de nuevo el
 * 2026-11-17 con la clave del proyecto: 429 RESOURCE_EXHAUSTED con
 * `limit: 0` en las cuotas `free_tier`. Ese caso se devuelve como `quota`
 * con un mensaje que lo dice claro, y la pantalla deja el camino manual
 * (copiar el prompt y abrir Gemini), que sí es gratis.
 *
 * Fetch directo, sin SDK, igual que el asistente (features/assistant). La
 * forma del pedido sale de la guía oficial "Image generation" de la Gemini
 * API (aistudio.google.com/docs/image-generation, variante generateContent):
 * texto + `inline_data` con la foto, y la imagen vuelve en
 * `candidates[0].content.parts[].inlineData`.
 */

export type GeminiImageDeps = {
  fetch?: typeof fetch;
  apiKey?: string | null;
  model?: string | null;
  timeoutMs?: number;
};

/**
 * Modelo principal de imagen según la guía oficial al 2026-11-17. Google da
 * de baja modelos seguido: se pisa con GEMINI_IMAGE_MODEL sin tocar código.
 */
const DEFAULT_MODEL = "gemini-nano-banana-2.1";

export function isGeminiImageConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

type GeminiPart = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};
type GeminiBody = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: GeminiPart[] };
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

const NO_FREE_TIER_MESSAGE =
  "El plan gratis de la clave de Gemini no incluye la generación de imágenes: Google la cobra aparte y hay que activar la facturación en esa cuenta. Usá el otro motor o generala a mano en Gemini (que ahí sí es gratis) con el prompt de abajo.";

function classify(
  status: number,
  error: GeminiBody["error"],
  model: string,
): AiImageResult {
  const text = error?.message ?? "";
  const quota = status === 429 || error?.status === "RESOURCE_EXHAUSTED";
  // Cuota 0 del plan gratis, o proyecto sin facturación: no es "esperá un
  // rato", es que esa clave no puede generar imágenes sin pagar.
  // (El 429 común también dice "check your plan and billing details": por eso
  // "billing" solo cuenta cuando NO es un error de cuota.)
  if (quota ? /free[_ ]tier|limit: 0\b/i.test(text) : /billing/i.test(text)) {
    return { ok: false, code: "quota", message: NO_FREE_TIER_MESSAGE };
  }
  if (quota) {
    return {
      ok: false,
      code: "quota",
      message:
        "Gemini llegó al límite de imágenes por ahora. Probá en un rato, usá el otro motor o generala a mano en Gemini con el prompt de abajo.",
    };
  }
  if (status === 404) {
    return {
      ok: false,
      code: "error",
      message: `Google ya no ofrece el modelo de imagen "${model}". Avisale a tu desarrollador para actualizar GEMINI_IMAGE_MODEL.`,
    };
  }
  if (status === 401 || status === 403 || /api key/i.test(text)) {
    return {
      ok: false,
      code: "error",
      message: `Google rechazó la clave de Gemini (${status}): revisá GEMINI_API_KEY en Vercel.`,
    };
  }
  return {
    ok: false,
    code: "error",
    message: `Gemini devolvió ${status}${text ? `: ${text.slice(0, 160)}` : ""}. Probá de nuevo en un momento.`,
  };
}

/**
 * Genera la foto de producto con Gemini a partir de la foto de la pieza y el
 * prompt (ver prompt.ts). Mismo contrato que el motor de Cloudflare. `deps`
 * permite inyectar fetch y la clave en tests. La clave viaja solo en el
 * header: nunca se loguea ni se devuelve.
 */
export async function generateProductImageWithGemini(
  input: { prompt: string; photo: Buffer; photoType: string },
  deps: GeminiImageDeps = {},
): Promise<AiImageResult> {
  const apiKey = deps.apiKey ?? env.GEMINI_API_KEY ?? null;
  if (!apiKey) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "El motor Gemini no está configurado: falta GEMINI_API_KEY en las variables de entorno.",
    };
  }
  const model = deps.model ?? env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL;
  const doFetch = deps.fetch ?? fetch;

  let res: Response;
  try {
    res = await doFetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: input.prompt },
                {
                  inline_data: {
                    mime_type: input.photoType,
                    data: input.photo.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
        signal: AbortSignal.timeout(deps.timeoutMs ?? 55_000),
      },
    );
  } catch (error) {
    // Solo el nombre del error: un mensaje de red nunca trae la clave, pero
    // así no hay forma de que termine en un log.
    console.error(
      "[ai-image] no se pudo llamar a Gemini:",
      error instanceof Error ? error.name : "error",
    );
    return {
      ok: false,
      code: "error",
      message:
        "No se pudo conectar con Gemini (o tardó demasiado). Probá de nuevo en un momento.",
    };
  }

  const body = (await res.json().catch(() => null)) as GeminiBody | null;
  if (!res.ok || body?.error) {
    const out = classify(res.status, body?.error, model);
    console.warn(
      "[ai-image] Gemini respondió",
      res.status,
      body?.error?.status ?? "",
      (body?.error?.message ?? "").slice(0, 200),
    );
    return out;
  }

  const candidate = body?.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    // Los modelos que "piensan" mandan bocetos marcados como thought: no son
    // la imagen final.
    if (part.thought) continue;
    const b64 = part.inlineData?.data ?? part.inline_data?.data;
    if (b64) {
      const image = Buffer.from(b64, "base64");
      return { ok: true, image, mimeType: mimeOf(image) };
    }
  }

  // 200 sin imagen: casi siempre es el filtro de contenido de Google.
  const reason = body?.promptFeedback?.blockReason ?? candidate?.finishReason;
  if (reason && reason !== "STOP") {
    return {
      ok: false,
      code: "flagged",
      message:
        "El filtro de Gemini no dejó generar esta pieza. Probá con el otro motor o generala a mano en Gemini con el prompt de abajo.",
    };
  }
  return {
    ok: false,
    code: "error",
    message: "Gemini contestó sin imagen. Probá de nuevo o usá el otro motor.",
  };
}
