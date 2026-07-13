"use server";

import { z } from "zod";
import { getStaffUser } from "@/core/auth/session";
import { rateLimit } from "@/core/security/rate-limit";
import { type ActionResult, toActionError } from "@/core/errors";
import { findTool } from "./tools";

const schema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
});

/**
 * Ejecuta una acción YA CONFIRMADA por el staff desde el chat del asistente.
 * Guard de staff + rate limit acá; la autorización fina (can()) y la validación
 * Zod las hace la ACTION que corre cada tool. El modelo NUNCA ejecuta solo:
 * el usuario confirma en la UI y recién ahí se llama esto.
 */
export async function runAssistantToolAction(
  input: unknown,
): Promise<ActionResult> {
  const staff = await getStaffUser();
  if (!staff) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const rl = await rateLimit(`assistant-run:${staff.id}`, {
    limit: 15,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return {
      ok: false,
      error: {
        code: "RATE_LIMIT",
        message: "Muchas acciones seguidas. Esperá un momento.",
      },
    };
  }
  const p = schema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Acción inválida." },
    };
  }
  const tool = findTool(p.data.name);
  if (!tool) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Acción desconocida." },
    };
  }
  try {
    return await tool.execute(p.data.args);
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
