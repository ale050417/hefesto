"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { costSettingsSchema, profitShareSchema } from "./schemas";
import * as service from "./service";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

export async function saveCostSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("ganancias", "editar"))) return NOT_STAFF;
  const parsed = costSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los valores." },
    };
  }
  try {
    await service.saveCostSettings(parsed.data);
    revalidatePath("/admin/ganancias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function createProfitShareAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("ganancias", "crear"))) return NOT_STAFF;
  const parsed = profitShareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  try {
    const s = await service.createProfitShare(parsed.data);
    revalidatePath("/admin/ganancias");
    return { ok: true, data: { id: s.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateProfitShareAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("ganancias", "editar"))) return NOT_STAFF;
  const parsed = profitShareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  try {
    await service.updateProfitShare(id, parsed.data);
    revalidatePath("/admin/ganancias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteProfitShareAction(
  id: string,
): Promise<ActionResult> {
  if (!(await can("ganancias", "eliminar"))) return NOT_STAFF;
  try {
    await service.deleteProfitShare(id);
    revalidatePath("/admin/ganancias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
