"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can, isAdmin } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import {
  calcConfigSchema,
  calcSaveSchema,
  marginPresetSchema,
  presetLikeSchema,
  quotePriceSchema,
} from "./schemas";
import { quoteFinalPriceFlow, saveCalcFlow } from "./flows";
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
    // Costo/kg y snapshot material/color se resuelven en el servidor desde el
    // FILAMENTO elegido (flujo compartido con la API de la app).
    const row = await saveCalcFlow(parsed.data, user.id);
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
 * Cotización del OPERADOR: elige un tipo y un FILAMENTO y carga gramos/horas;
 * el servidor resuelve el costo del filamento (por id, no por nombre) y el
 * margen del tipo, y devuelve SOLO el precio final (el % nunca llega al
 * navegador). Requiere ver calculadora.
 */
export async function quotePriceAction(
  input: unknown,
): Promise<ActionResult<{ precioFinal: number }>> {
  if (!(await can("calculadora", "ver"))) return NOT_STAFF;
  const parsed = quotePriceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Elegí un tipo de producto y un filamento.",
      },
    };
  }
  try {
    // Costo/kg resuelto en el servidor desde el filamento elegido (flujo
    // compartido con la API de la app).
    return { ok: true, data: await quoteFinalPriceFlow(parsed.data) };
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

/**
 * Tipo de producto nuevo creado por quien cotiza (sugerencia de Agustín,
 * 2026-11-25). No se carga un margen: se elige un tipo que ya existe y el
 * nuevo se cobra igual. El % solo se devuelve al admin.
 */
export async function createPresetLikeAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; marginPct?: number }>> {
  const user = await getCurrentUser();
  if (!user || !(await can("calculadora", "crear"))) return NOT_STAFF;
  const parsed = presetLikeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Poné un nombre y elegí con qué tipo se cobra igual.",
      },
    };
  }
  try {
    const row = await service.createPresetLike(
      parsed.data,
      user.profile?.fullName?.trim() || null,
    );
    revalidatePath("/admin/calculadora");
    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        ...((await isAdmin()) ? { marginPct: row.marginPct } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
