"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can, isAdmin } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { listFilamentsView } from "@/features/inventory/queries";
import {
  calcConfigSchema,
  calcSaveSchema,
  marginPresetSchema,
} from "./schemas";
import * as service from "./service";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

const NOT_ADMIN = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "Solo el administrador" },
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
    // Costo/kg resuelto en el servidor desde el material (no se confía en el cliente).
    const filaments = await listFilamentsView();
    const costPerKg =
      filaments.find((fm) => fm.material === parsed.data.material)?.costPerKg ??
      0;
    const row = await service.createCalc(parsed.data, costPerKg, user.id);
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

/* ---------- Tipos de producto con margen (SOLO admin) ---------- */

export async function saveMarginPresetAction(
  id: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const parsed = marginPresetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá el nombre y el margen del tipo.",
      },
    };
  }
  try {
    const row = id
      ? await service.updateMarginPreset(id, parsed.data)
      : await service.createMarginPreset(parsed.data);
    revalidatePath("/admin/calculadora");
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteMarginPresetAction(
  id: string,
): Promise<ActionResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    await service.deleteMarginPreset(id);
    revalidatePath("/admin/calculadora");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Cotización del OPERADOR: elige un tipo y carga gramos/horas/material; el
 * servidor resuelve el costo del material y el margen del tipo, y devuelve SOLO
 * el precio final (el % nunca llega al navegador). Requiere ver calculadora.
 */
export async function quotePriceAction(input: {
  presetId: string;
  grams: number;
  hours: number;
  material: string;
}): Promise<ActionResult<{ precioFinal: number }>> {
  if (!(await can("calculadora", "ver"))) return NOT_STAFF;
  const presetId = String(input?.presetId ?? "");
  const grams = Number(input?.grams) || 0;
  const hours = Number(input?.hours) || 0;
  const material = String(input?.material ?? "");
  if (!presetId) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Elegí un tipo de producto." },
    };
  }
  try {
    // Costo/kg resuelto en el servidor desde el material (no se confía en el cliente).
    const filaments = await listFilamentsView();
    const costPerKg =
      filaments.find((f) => f.material === material)?.costPerKg ?? 0;
    const result = await service.quoteFinalPriceByPreset({
      presetId,
      grams,
      hours,
      costPerKg,
    });
    if (!result) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "El tipo no está disponible." },
      };
    }
    return { ok: true, data: result };
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
