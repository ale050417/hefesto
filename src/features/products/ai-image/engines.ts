/**
 * Motores de la foto de producto con IA (2026-11-17, pedido de Agustín:
 * "tener dos opciones"). Sin imports de servidor: lo usan la ruta y el panel.
 *
 * Cuáles se ofrecen lo decide el SERVIDOR según las claves configuradas (GET
 * de /api/admin/products/ai-image); el panel no da nada por sentado.
 */
export type AiImageEngine = "cloudflare" | "gemini";

export type AiImageEngineInfo = {
  id: AiImageEngine;
  label: string;
  /** Aclaración que se muestra al elegirlo (sobre todo: si cuesta plata). */
  hint: string;
};

/** En orden de preferencia: el primero disponible es el motor por defecto. */
export const AI_IMAGE_ENGINES: readonly AiImageEngineInfo[] = [
  {
    id: "cloudflare",
    label: "FLUX (gratis)",
    hint: "El de siempre: gratis, unas 7 a 10 imágenes por día. No genera personajes con derechos (Pokémon y similares).",
  },
  {
    id: "gemini",
    label: "Gemini",
    hint: "El modelo de imagen de Google, con la clave de Gemini. Google cobra cada imagen: con el plan gratis de la clave no genera.",
  },
];

export function parseAiImageEngine(value: unknown): AiImageEngine | null {
  return AI_IMAGE_ENGINES.find((e) => e.id === value)?.id ?? null;
}

/** Los motores con clave configurada, en orden de preferencia. */
export function availableAiImageEngines(configured: {
  cloudflare: boolean;
  gemini: boolean;
}): AiImageEngineInfo[] {
  return AI_IMAGE_ENGINES.filter((e) => configured[e.id]);
}
