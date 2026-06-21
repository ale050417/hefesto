"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import * as queries from "./queries";
import { failureSchema, filamentSchema } from "./schemas";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function saveFilamentAction(
  input: unknown,
  id?: string,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  const parsed = filamentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    if (id) await queries.updateFilament(id, parsed.data);
    else await queries.addFilament(parsed.data);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function registerFailureAction(
  input: unknown,
): Promise<ActionResult<{ lowStock: boolean }>> {
  if (!(await isStaff())) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = failureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    const res = await queries.recordFailure(parsed.data);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "inventory.failure_registered",
      entityType: "filament",
      entityId: parsed.data.filamentId,
      metadata: {
        gramsLost: parsed.data.gramsLost,
        deducted: parsed.data.deducted ?? true,
      },
    });
    revalidatePath("/admin/fallas");
    revalidatePath("/admin/filamentos");
    return { ok: true, data: res };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
