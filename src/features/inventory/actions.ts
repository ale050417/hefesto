"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { deleteFailureFlow, registerFailureFlow } from "./failure-flow";
import * as filamentTypes from "./filament-types";
import * as queries from "./queries";
import {
  brandSchema,
  colorSchema,
  failureSchema,
  filamentSchema,
  filamentTypeSchema,
  spoolModelSchema,
  weighSchema,
} from "./schemas";

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
    // Stock por el ledger + aviso + auditoría + revalidación: compartido con la
    // API de la app (ver failure-flow.ts).
    const res = await registerFailureFlow(parsed.data, user?.id ?? null);
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
    // Borrar una falla DEVUELVE al stock los gramos que había descontado
    // (+ auditoría + revalidación, compartido con la API de la app).
    await deleteFailureFlow(id, user?.id ?? null);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function addColorAction(input: unknown): Promise<ActionResult> {
  if (!(await can("filamentos", "crear"))) return NOT_STAFF;
  const parsed = colorSchema.safeParse(input);
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
    await queries.addColor(parsed.data);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function addBrandAction(input: unknown): Promise<ActionResult> {
  if (!(await can("filamentos", "crear"))) return NOT_STAFF;
  const parsed = brandSchema.safeParse(input);
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
    await queries.addBrand(parsed.data);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteColorAction(name: string): Promise<ActionResult> {
  if (!(await can("filamentos", "eliminar"))) return NOT_STAFF;
  try {
    await queries.removeColor(name);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteBrandAction(name: string): Promise<ActionResult> {
  if (!(await can("filamentos", "eliminar"))) return NOT_STAFF;
  try {
    await queries.removeBrand(name);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function addMaterialAction(input: unknown): Promise<ActionResult> {
  if (!(await can("filamentos", "crear"))) return NOT_STAFF;
  const parsed = brandSchema.safeParse(input);
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
    await queries.addMaterial(parsed.data);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteMaterialAction(
  name: string,
): Promise<ActionResult> {
  if (!(await can("filamentos", "eliminar"))) return NOT_STAFF;
  try {
    await queries.removeMaterial(name);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Tipos de filamento con precio y carretes vacíos (0084) ---------- */

function invalid(error: import("zod").ZodError) {
  const fields = fieldErrors(error);
  return {
    ok: false as const,
    error: {
      code: "VALIDATION",
      message: Object.values(fields)[0] ?? "Revisá los datos.",
      fields,
    },
  };
}

/** Alta/edición de un tipo. Al editar, su precio baja a todos sus carretes. */
export async function saveFilamentTypeAction(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string; spools: number }>> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = filamentTypeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const data = await filamentTypes.saveFilamentType(
      id,
      parsed.data,
      user?.id ?? null,
    );
    revalidatePath("/admin/filamentos");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteFilamentTypeAction(
  id: string,
): Promise<ActionResult> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  try {
    await filamentTypes.deleteFilamentType(id);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function saveSpoolModelAction(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  const parsed = spoolModelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const data = await filamentTypes.saveSpoolModel(id, parsed.data);
    revalidatePath("/admin/filamentos");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteSpoolModelAction(
  id: string,
): Promise<ActionResult> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  try {
    await filamentTypes.deleteSpoolModel(id);
    revalidatePath("/admin/filamentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** "Calcular filamento": confirma el pesado y actualiza el stock. */
export async function weighFilamentAction(
  id: string,
  input: unknown,
): Promise<ActionResult<filamentTypes.WeighResult>> {
  if (!(await can("filamentos", "editar"))) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = weighSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const data = await filamentTypes.weighFilament(
      id,
      parsed.data,
      user?.id ?? null,
    );
    revalidatePath("/admin/filamentos");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
