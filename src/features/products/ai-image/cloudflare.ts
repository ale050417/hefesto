import { env } from "@/core/config/env";

/**
 * Foto de producto con IA: FLUX.2 klein en Cloudflare Workers AI (decisión
 * 2026-10-21). Gratis: 10.000 neurons por día sin tarjeta (unas 7 a 10
 * imágenes), por eso y no Gemini, cuya generación de imágenes es solo paga.
 *
 * Recibe la foto de la pieza (ya achicada en el navegador: el modelo exige
 * referencias menores a 512×512) y devuelve el PNG generado. Los dos
 * rechazos que importan se devuelven con código propio, no como error
 * genérico:
 *  - `flagged`: el filtro de Cloudflare bloquea PERSONAJES CON DERECHOS
 *    (probado con Pokémon: siempre rechaza; con piezas propias, nunca). Para
 *    esos, la pantalla deja el prompt listo para generar a mano en Gemini.
 *  - `quota`: se agotó la cuota gratis del día.
 */

export type AiImageResult =
  | { ok: true; image: Buffer; mimeType: "image/png" | "image/jpeg" }
  | {
      ok: false;
      code: "not_configured" | "flagged" | "quota" | "error";
      message: string;
    };

export type AiImageDeps = {
  fetch?: typeof fetch;
  accountId?: string | null;
  token?: string | null;
  model?: string | null;
  timeoutMs?: number;
};

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
/** Código de Cloudflare cuando el filtro de contenido bloquea la salida. */
const FLAGGED_CODE = 3030;

export function isAiImageConfigured(): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_TOKEN);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function mimeOf(buf: Buffer): "image/png" | "image/jpeg" {
  return buf.subarray(0, 4).equals(PNG_MAGIC) ? "image/png" : "image/jpeg";
}

type CfError = { code?: number; message?: string };
type CfBody = {
  success?: boolean;
  errors?: CfError[];
  result?: { image?: string };
};

function classify(status: number, errors: CfError[]): AiImageResult {
  const text = errors.map((e) => e.message ?? "").join(" | ");
  if (errors.some((e) => e.code === FLAGGED_CODE) || /flagged/i.test(text)) {
    return {
      ok: false,
      code: "flagged",
      message:
        "El filtro de Cloudflare no deja generar esta pieza (pasa con personajes con derechos, como Pokémon). Podés generarla a mano en Gemini con el prompt de abajo.",
    };
  }
  if (status === 429 || /quota|limit|neurons|allocation/i.test(text)) {
    return {
      ok: false,
      code: "quota",
      message:
        "Se agotó la cuota gratis de imágenes de hoy en Cloudflare. Mañana vuelve a estar disponible; mientras, podés generarla a mano en Gemini con el prompt de abajo.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "error",
      message: `Cloudflare rechazó el token (${status}): revisá CLOUDFLARE_AI_TOKEN y CLOUDFLARE_ACCOUNT_ID en Vercel.`,
    };
  }
  return {
    ok: false,
    code: "error",
    message: `Cloudflare devolvió ${status}${text ? `: ${text.slice(0, 160)}` : ""}. Probá de nuevo en un momento.`,
  };
}

/**
 * Genera la foto de producto a partir de la foto de la pieza y el prompt
 * (ver prompt.ts). `deps` permite inyectar fetch y credenciales en tests.
 */
export async function generateProductImage(
  input: { prompt: string; photo: Buffer; photoType: string },
  deps: AiImageDeps = {},
): Promise<AiImageResult> {
  const accountId = deps.accountId ?? env.CLOUDFLARE_ACCOUNT_ID ?? null;
  const token = deps.token ?? env.CLOUDFLARE_AI_TOKEN ?? null;
  if (!accountId || !token) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "La generación de imágenes no está configurada: faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_AI_TOKEN en las variables de entorno.",
    };
  }
  const model = deps.model ?? env.CLOUDFLARE_AI_IMAGE_MODEL ?? DEFAULT_MODEL;
  const doFetch = deps.fetch ?? fetch;

  const form = new FormData();
  form.set("prompt", input.prompt);
  form.set(
    "input_image_0",
    new Blob([new Uint8Array(input.photo)], { type: input.photoType }),
    "photo",
  );
  form.set("width", "1024");
  form.set("height", "1024");

  let res: Response;
  try {
    res = await doFetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(deps.timeoutMs ?? 55_000),
      },
    );
  } catch (error) {
    console.error("[ai-image] no se pudo llamar a Cloudflare:", error);
    return {
      ok: false,
      code: "error",
      message:
        "No se pudo conectar con Cloudflare (o tardó demasiado). Probá de nuevo en un momento.",
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const body = (await res.json().catch(() => null)) as CfBody | null;
    const b64 = body?.result?.image;
    if (res.ok && body?.success !== false && b64) {
      const image = Buffer.from(b64, "base64");
      return { ok: true, image, mimeType: mimeOf(image) };
    }
    const errors = body?.errors ?? [];
    const out = classify(res.status, errors);
    if (!out.ok && out.code !== "flagged") {
      console.warn("[ai-image] Cloudflare respondió", res.status, errors);
    }
    return out;
  }
  if (res.ok) {
    // Algunos modelos devuelven la imagen en binario directo.
    const image = Buffer.from(await res.arrayBuffer());
    return { ok: true, image, mimeType: mimeOf(image) };
  }
  return classify(res.status, [
    { message: (await res.text().catch(() => "")).slice(0, 200) },
  ]);
}
