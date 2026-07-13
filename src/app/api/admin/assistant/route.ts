import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/core/auth/session";
import { rateLimit } from "@/core/security/rate-limit";
import {
  askAssistantSmart,
  isAssistantConfigured,
} from "@/features/assistant/service";

/**
 * Endpoint del asistente IA del admin. Autorización en el servidor (solo
 * staff), validación con Zod y rate limit por usuario (Cap. 11/14).
 */

export const maxDuration = 30;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  // Guard de staff: si la DB de auth no responde, error claro (no 500 mudo).
  let staff;
  try {
    staff = await getStaffUser();
  } catch {
    return NextResponse.json(
      { error: "No pudimos verificar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (!staff) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!isAssistantConfigured()) {
    return NextResponse.json(
      {
        error:
          "El asistente no está configurado: falta GEMINI_API_KEY (gratis, aistudio.google.com) o ANTHROPIC_API_KEY en las variables de entorno de Vercel.",
      },
      { status: 501 },
    );
  }

  const rl = await rateLimit(`assistant:${staff.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas seguidas. Esperá un minuto." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje inválido." }, { status: 400 });
  }

  try {
    const result = await askAssistantSmart(parsed.data.messages);
    if (result.type === "action") {
      return NextResponse.json({ action: result });
    }
    return NextResponse.json({ reply: result.text });
  } catch (e) {
    console.error("[asistente] no pudo responder:", e);
    // Diagnóstico útil en la UI: el código de la API dice qué pasa sin ir a
    // los logs (401 = key inválida; 400/403 suele ser falta de crédito).
    const msg = e instanceof Error ? e.message : "";
    const apiStatus = /^ASSISTANT_API_ERROR:(\d+)$/.exec(msg)?.[1];
    let hint = "El asistente no pudo responder. Probá en un momento.";
    if (apiStatus === "401" || apiStatus === "403") {
      hint = `La API de IA rechazó la key (${apiStatus}): revisá que esté bien copiada en Vercel.`;
    } else if (apiStatus === "400") {
      hint =
        "La API de IA devolvió 400: si usás Anthropic suele ser falta de crédito (Billing); si usás Gemini, revisá la key.";
    } else if (apiStatus === "429") {
      hint =
        "Se alcanzó el límite de consultas del proveedor de IA. Esperá un minuto y probá de nuevo.";
    } else if (apiStatus === "404") {
      hint =
        "El proveedor de IA dio de baja el modelo configurado. Avisale a tu desarrollador para actualizar GEMINI_MODEL.";
    } else if (apiStatus) {
      hint = `La API de IA devolvió ${apiStatus}. Probá en un momento.`;
    }
    return NextResponse.json({ error: hint }, { status: 502 });
  }
}
