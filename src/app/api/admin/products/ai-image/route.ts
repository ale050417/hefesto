import { NextResponse } from "next/server";
import { z } from "zod";
import { can } from "@/core/auth/permissions";
import { getStaffUser } from "@/core/auth/session";
import { rateLimit } from "@/core/security/rate-limit";
import {
  generateProductImage,
  isAiImageConfigured,
} from "@/features/products/ai-image/cloudflare";
import { buildProductImagePrompt } from "@/features/products/ai-image/prompt";

/**
 * Foto de producto con IA a partir de una foto de la pieza (botón "Generar
 * con IA" del alta y la edición de productos, 2026-10-21). Multipart:
 *  - image: la foto, ya achicada en el navegador (≤ 512 px, ≤ 2 MB);
 *  - name, category, colors (JSON), description, scene: el contexto para
 *    elegir la escena (ver ai-image/prompt.ts).
 * Devuelve la imagen como data URL. Si Cloudflare la rechaza (`flagged`,
 * `quota`), va el prompt igual: la pantalla lo deja listo para Gemini.
 *
 * Es un route handler y no una server action para tener su propio
 * maxDuration (el modelo tarda entre 5 y 35 s) y una respuesta grande.
 */
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(80).optional(),
  colors: z.array(z.string().trim().max(40)).max(24).optional(),
  description: z.string().trim().max(600).optional(),
  scene: z.string().trim().max(200).optional(),
});

function fail(status: number, code: string, message: string, prompt?: string) {
  return NextResponse.json({ ok: false, code, message, prompt }, { status });
}

export async function POST(req: Request) {
  let staff;
  try {
    staff = await getStaffUser();
  } catch {
    return fail(503, "auth", "No pudimos verificar tu sesión. Probá de nuevo.");
  }
  if (!staff) return fail(401, "auth", "No autorizado.");
  if (!(await can("productos", "crear"))) {
    return fail(403, "auth", "No tenés permiso para cargar productos.");
  }
  if (!isAiImageConfigured()) {
    return fail(
      501,
      "not_configured",
      "La generación de imágenes no está configurada: faltan CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_AI_TOKEN en las variables de entorno de Vercel.",
    );
  }

  // Cada imagen consume cuota gratis del día: tope por usuario.
  const rl = await rateLimit(`ai-image:${staff.id}`, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return fail(429, "rate", "Demasiadas imágenes seguidas. Esperá un minuto.");
  }

  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, "invalid", "Pedido inválido.");
  const file = form.get("image");
  if (!(file instanceof File)) {
    return fail(400, "invalid", "Falta la foto de la pieza.");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return fail(400, "invalid", "Formato no permitido (JPG, PNG o WebP).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail(400, "invalid", "La foto es muy pesada (máximo 2 MB).");
  }
  let colors: unknown = undefined;
  const colorsRaw = form.get("colors");
  if (typeof colorsRaw === "string" && colorsRaw) {
    try {
      colors = JSON.parse(colorsRaw);
    } catch {
      colors = undefined;
    }
  }
  const parsed = fieldsSchema.safeParse({
    name: form.get("name") ?? undefined,
    category: form.get("category") || undefined,
    colors,
    description: form.get("description") || undefined,
    scene: form.get("scene") || undefined,
  });
  if (!parsed.success) {
    return fail(
      400,
      "invalid",
      "Escribí primero el nombre del producto (paso Básicos).",
    );
  }

  const prompt = buildProductImagePrompt(parsed.data);
  const result = await generateProductImage({
    prompt,
    photo: Buffer.from(await file.arrayBuffer()),
    photoType: file.type,
  });
  if (!result.ok) {
    const status =
      result.code === "flagged"
        ? 422
        : result.code === "quota"
          ? 429
          : result.code === "not_configured"
            ? 501
            : 502;
    return fail(status, result.code, result.message, prompt);
  }
  return NextResponse.json({
    ok: true,
    prompt,
    image: `data:${result.mimeType};base64,${result.image.toString("base64")}`,
  });
}
