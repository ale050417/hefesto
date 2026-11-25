import { recordAudit } from "@/core/audit";
import { NotFoundError, ValidationError } from "@/core/errors";
import { adjustStock } from "./queries";
import { planWeigh, type WeighPlan } from "./weigh";
import * as repo from "./repository";
import type { FilamentTypeInput, SpoolModelInput, WeighInput } from "./schemas";

/**
 * Tipos de filamento con precio y "Calcular filamento" pesando el carrete
 * (pedidos de Agustín, 2026-11-24). Lo comparten las Server Actions de la web
 * y la API de la app; la autorización la valida cada caller.
 *
 * - El precio por kg vive en el TIPO (PLA, PETG, PLA Silk…). Cada carrete
 *   elige su tipo y copia ese precio; al cambiar el precio del tipo cambian
 *   todos sus carretes ("cambiarlo en un solo lugar y no en los 32 carretes").
 * - Un carrete sin tipo conserva su precio propio.
 */

export type FilamentTypeView = {
  id: string;
  name: string;
  costPerKg: number;
  /** Cuántos carretes usan este tipo. */
  spools: number;
};

export type SpoolModelView = { id: string; name: string; emptyGrams: number };

const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export async function listFilamentTypesView(): Promise<FilamentTypeView[]> {
  const [types, filaments] = await Promise.all([
    repo.listFilamentTypes(),
    repo.listFilaments(),
  ]);
  const count = new Map<string, number>();
  for (const f of filaments) {
    if (f.typeId) count.set(f.typeId, (count.get(f.typeId) ?? 0) + 1);
  }
  return types.map((t) => ({
    id: t.id,
    name: t.name,
    costPerKg: Number(t.costPerKg),
    spools: count.get(t.id) ?? 0,
  }));
}

/**
 * Alta o edición de un tipo. Al editar, el precio nuevo baja a todos sus
 * carretes; devuelve cuántos cambiaron.
 */
export async function saveFilamentType(
  id: string | null,
  input: FilamentTypeInput,
  actorId: string | null,
): Promise<{ id: string; spools: number }> {
  const fields = { name: input.name, costPerKg: String(input.costPerKg) };
  try {
    if (!id) {
      const row = await repo.insertFilamentType(fields);
      return { id: row.id, spools: 0 };
    }
    const before = await repo.findFilamentTypeById(id);
    const { row, spools } = await repo.updateFilamentTypeTx(id, fields);
    if (!row) throw new NotFoundError("No encontramos el tipo de filamento.");
    if (before && Number(before.costPerKg) !== input.costPerKg) {
      await recordAudit({
        actorId,
        action: "inventory.filament_type_price_changed",
        entityType: "filament_type",
        entityId: id,
        metadata: {
          name: row.name,
          previous: Number(before.costPerKg),
          costPerKg: input.costPerKg,
          spools,
        },
      });
    }
    return { id: row.id, spools };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError("Ya hay un tipo con ese nombre.");
    }
    throw error;
  }
}

export async function deleteFilamentType(id: string): Promise<void> {
  await repo.deleteFilamentTypeRow(id);
}

/* ---------- Modelos de carrete vacío ---------- */

export async function listSpoolModelsView(): Promise<SpoolModelView[]> {
  return (await repo.listSpoolModels()).map((m) => ({
    id: m.id,
    name: m.name,
    emptyGrams: Number(m.emptyGrams),
  }));
}

export async function saveSpoolModel(
  id: string | null,
  input: SpoolModelInput,
): Promise<{ id: string }> {
  const fields = { name: input.name, emptyGrams: String(input.emptyGrams) };
  try {
    if (!id) return { id: (await repo.insertSpoolModel(fields)).id };
    const row = await repo.updateSpoolModelRow(id, fields);
    if (!row) throw new NotFoundError("No encontramos el modelo de carrete.");
    return { id: row.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError("Ya hay un carrete con ese nombre.");
    }
    throw error;
  }
}

export async function deleteSpoolModel(id: string): Promise<void> {
  await repo.deleteSpoolModelRow(id);
}

/* ---------- Calcular filamento pesando el carrete ---------- */

const r2 = (n: number) => Math.round(n * 100) / 100;

export type WeighResult = WeighPlan & {
  previousStock: number;
  /** false si el stock ya era ese (no se registra movimiento). */
  changed: boolean;
  lowStock: boolean;
};

/**
 * Confirma el pesado: fija el stock por el ledger (queda en el historial del
 * carrete, como cualquier ajuste) y recuerda el modelo de carrete para la
 * próxima vez.
 */
export async function weighFilament(
  id: string,
  input: WeighInput,
  actorId: string | null,
): Promise<WeighResult> {
  const [filament, model] = await Promise.all([
    repo.findFilamentById(id),
    repo.findSpoolModelById(input.spoolModelId),
  ]);
  if (!filament) throw new NotFoundError("No encontramos el filamento.");
  if (!model) {
    throw new ValidationError("El modelo de carrete ya no existe. Elegí otro.");
  }
  const emptyGrams = Number(model.emptyGrams);
  const plan = planWeigh({
    totalGrams: input.totalGrams,
    emptyGrams,
    sealedSpools: input.sealedSpools,
    spoolGrams: Number(filament.spoolGrams),
  });
  const previousStock = Number(filament.stockGrams);

  if (filament.spoolModelId !== model.id) {
    await repo.updateFilamentRow(id, { spoolModelId: model.id });
  }
  if (plan.newStockGrams === r2(previousStock)) {
    return { ...plan, previousStock, changed: false, lowStock: false };
  }
  const sealed = Math.max(0, Math.floor(input.sealedSpools ?? 0));
  const res = await adjustStock(
    id,
    { newStockGrams: plan.newStockGrams },
    {
      reason:
        `Pesado: ${r2(input.totalGrams)} g − carrete ${model.name} (${emptyGrams} g)` +
        (sealed > 0 ? ` + ${sealed} carrete(s) cerrado(s)` : ""),
      actorId,
    },
  );
  return { ...plan, previousStock, changed: true, lowStock: res.lowStock };
}
