import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffUser } from "@/core/auth/session";
import { rateLimit } from "@/core/security/rate-limit";
import {
  askAssistant,
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
          "El asistente no está configurado: falta ANTHROPIC_API_KEY en las variables de entorno (Vercel → Settings → Environment Variables).",
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
    const reply = await askAssistant(parsed.data.messages);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[asistente] no pudo responder:", e);
    return NextResponse.json(
      { error: "El asistente no pudo responder. Probá en un momento." },
      { status: 502 },
    );
  }
}
