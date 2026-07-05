"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
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
  if (!(await can("filamentos", id ? "editar" : "crear"))) return NOT_STAFF;
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

export async function addSpoolAction(id: string): Promise<ActionResult> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  try {
    await queries.addSpool(id);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteFilamentAction(id: string): Promise<ActionResult> {
  if (!(await can("filamentos", "eliminar"))) return NOT_STAFF;
  try {
    await queries.deleteFilament(id);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function registerFailureAction(
  input: unknown,
): Promise<ActionResult<{ lowStock: boolean; deducted: boolean }>> {
  if (!(await can("fallas", "crear"))) return NOT_STAFF;
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
      entityId: null,
      metadata: {
        material: parsed.data.material,
        color: parsed.data.color,
        gramsLost: parsed.data.gramsLost,
        deducted: res.deducted,
      },
    });
    revalidatePath("/admin/fallas");
    revalidatePath("/admin/filamentos");
    return { ok: true, data: res };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateFailureAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("fallas", "editar"))) return NOT_STAFF;
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
    await queries.updateFailure(id, parsed.data);
    revalidatePath("/admin/fallas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteFailureAction(id: string): Promise<ActionResult> {
  if (!(await can("fallas", "eliminar"))) return NOT_STAFF;
  const user = await getCurrentUser();
  try {
    // Borrar una falla DEVUELVE al stock los gramos que había descontado.
    const { restored } = await queries.deleteFailure(id);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "inventory.failure_deleted",
      entityType: "filament",
      entityId: null,
      metadata: { restoredGrams: restored },
    });
    revalidatePath("/admin/fallas");
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
