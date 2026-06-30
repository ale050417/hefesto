"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { calcConfigSchema, calcSaveSchema } from "./schemas";
import * as service from "./service";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

export async function saveCalcAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user || !(await can("calculadora", "crear"))) return NOT_STAFF;
  const parsed = calcSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos del cálculo." },
    };
  }
  try {
    const row = await service.createCalc(parsed.data, user.id);
    revalidatePath("/admin/calculadora");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteCalcAction(id: string): Promise<ActionResult> {
  if (!(await can("calculadora", "eliminar"))) return NOT_STAFF;
  try {
    await service.deleteCalc(id);
    revalidatePath("/admin/calculadora");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function saveCalcConfigAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("calculadora", "editar"))) return NOT_STAFF;
  const parsed = calcConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá la configuración." },
    };
  }
  try {
    await service.saveCalcConfig(parsed.data);
    revalidatePath("/admin/calculadora");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
