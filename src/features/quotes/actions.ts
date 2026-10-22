"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { saveQuoteDefaults } from "./service";

const schema = z.object({
  title: z.string().trim().min(3).max(80),
  depositPct: z.coerce.number().int().min(0).max(100),
  depositText: z.string().trim().max(300),
  notes: z.array(z.string().trim().min(1).max(600)).max(10),
});

/**
 * Guarda los textos por defecto de la cotización. Lo puede hacer quien edita
 * productos o pedidos (es operativo, no configuración de la tienda).
 */
export async function saveQuoteDefaultsAction(
  input: unknown,
): Promise<ActionResult> {
  const allowed =
    (await can("productos", "editar")) || (await can("pedidos", "editar"));
  if (!allowed) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los textos." },
    };
  }
  try {
    await saveQuoteDefaults(parsed.data);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
