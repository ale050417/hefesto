import { NotFoundError } from "@/core/errors";
import * as repo from "./repository";
import { notifyLowStockAfterSale } from "./lowStockNotify";
import {
  buildFailureMovements,
  deleteFailure as runDeleteFailure,
  filamentStatus,
  isLowStock,
  registerFailure,
} from "./service";
import type { FailureInput, FilamentInput } from "./schemas";
import type { Filament, FilamentView, PrintFailure } from "./types";

export async function listFilamentsView(): Promise<FilamentView[]> {
  const rows = await repo.listFilaments();
  return rows.map((f) => {
    const stock = Number(f.stockGrams);
    const threshold = Number(f.alertThresholdGrams);
    return {
      id: f.id,
      material: f.material,
      color: f.color,
      brand: f.brand,
      diameter: f.diameter,
      stockGrams: stock,
      spoolGrams: Number(f.spoolGrams),
      costPerKg: Number(f.costPerKg),
      alertThresholdGrams: threshold,
      lowStock: isLowStock(stock, threshold),
      status: filamentStatus(stock, threshold),
    };
  });
}

export async function getFilament(id: string): Promise<Filament | null> {
  return repo.findFilamentById(id);
}

function toRow(input: FilamentInput) {
  return {
    material: input.material,
    color: input.color,
    brand: input.brand,
    diameter: input.diameter,
    stockGrams: String(input.stockGrams),
    spoolGrams: String(input.spoolGrams),
    costPerKg: String(input.costPerKg),
    alertThresholdGrams: String(input.alertThresholdGrams),
  };
}

export async function addFilament(input: FilamentInput): Promise<Filament> {
  return repo.insertFilament(toRow(input));
}

export async function updateFilament(
  id: string,
  input: FilamentInput,
): Promise<Filament> {
  return repo.updateFilamentRow(id, toRow(input));
}

/** Suma un carrete (spoolGrams) al stock actual. */
export async function addSpool(id: string): Promise<Filament> {
  const f = await repo.findFilamentById(id);
  if (!f) throw new NotFoundError("No encontramos el filamento.");
  const newStock = Number(f.stockGrams) + Number(f.spoolGrams);
  return repo.updateFilamentRow(id, { stockGrams: String(newStock) });
}

export async function deleteFilament(id: string): Promise<void> {
  await repo.deleteFilamentRow(id);
}

export async function listFailures(): Promise<PrintFailure[]> {
  return repo.listFailures();
}

export async function recordFailure(
  input: FailureInput,
): Promise<{ lowStock: boolean; deducted: boolean }> {
  const deducted = input.deducted ?? true;
  const lines = input.colorLines ?? [];

  // Camino multicolor (nuevo): cada carrete descuenta por el ledger, en una
  // sola transacción con la falla. Si a algún color no le alcanza, la falla
  // igual queda registrada y se avisa al panel (shortfall).
  if (lines.length > 0) {
    const fils = await repo.listFilaments();
    const movements = buildFailureMovements(lines, fils);

    const willDeduct = deducted && movements.length > 0;
    const { low } = await repo.registerFailureWithDeltasTx(
      {
        filamentId: willDeduct ? (movements[0]!.filamentId ?? null) : null,
        pieceName: input.pieceName,
        material: input.material,
        color: input.color,
        gramsLost: input.gramsLost,
        reason: input.reason,
        notes: input.notes ?? null,
        deducted: willDeduct,
      },
      willDeduct ? movements : [],
    );
    if (low.length > 0) {
      await notifyLowStockAfterSale(low, "falla").catch(() => undefined);
    }
    return { lowStock: low.some((l) => !l.shortfall), deducted: willDeduct };
  }

  // Camino viejo (sin colorLines): material+color → un carrete.
  const res = await registerFailure(
    {
      pieceName: input.pieceName,
      material: input.material,
      color: input.color,
      gramsLost: input.gramsLost,
      reason: input.reason,
      notes: input.notes ?? null,
      deducted,
    },
    {
      findFilament: repo.findFilamentByMaterialColor,
      persist: (p) => repo.registerFailureTx(p),
    },
  );
  if (res.lowStock) {
    await notifyLowStockAfterSale(
      [
        {
          filamentId: "",
          material: input.material,
          color: input.color,
          stockGrams: 0,
          threshold: 0,
        },
      ],
      "falla",
    ).catch(() => undefined);
  }
  return res;
}

export async function updateFailure(
  id: string,
  input: FailureInput,
): Promise<PrintFailure> {
  return repo.updateFailureRow(id, {
    pieceName: input.pieceName,
    material: input.material,
    color: input.color,
    gramsLost: String(input.gramsLost),
    reason: input.reason,
    notes: input.notes ?? null,
  });
}

export async function deleteFailure(id: string): Promise<{ restored: number }> {
  // Nuevo/backfilled: la falla descontó por el ledger → reversa por ahí
  // (repone el delta REAL aplicado de cada carrete y borra sus movimientos).
  const movs = await repo.findMovementsByRef("failure", id);
  if (movs.length > 0) {
    const restored = movs.reduce(
      (a, m) => a + Math.max(0, -Number(m.deltaGrams)),
      0,
    );
    await repo.deleteFailureWithLedgerTx(id);
    return { restored };
  }
  // Viejo sin ledger (o no descontada): reversa directa como antes. Si la falla
  // no existe, runDeleteFailure tira NotFoundError.
  return runDeleteFailure(id, {
    findFailure: repo.findFailureById,
    findFilamentById: repo.findFilamentById,
    persist: (p) => repo.deleteFailureTx(p),
  });
}

// --- Catálogo de colores y marcas (0042): lista para los selectores del form
// y alta de nuevos desde el botón "＋". ---
export type CatalogItem = repo.CatalogRow;

export function listColorCatalog(): Promise<CatalogItem[]> {
  return repo.listFilamentCatalog("color");
}

export function listBrandCatalog(): Promise<CatalogItem[]> {
  return repo.listFilamentCatalog("brand");
}

export function listMaterialCatalog(): Promise<CatalogItem[]> {
  return repo.listFilamentCatalog("material");
}

export async function addColor(input: {
  name: string;
  hex?: string | null;
}): Promise<void> {
  await repo.insertFilamentCatalog("color", input.name, input.hex ?? null);
}

export async function addBrand(input: { name: string }): Promise<void> {
  await repo.insertFilamentCatalog("brand", input.name, null);
}

export async function addMaterial(input: { name: string }): Promise<void> {
  await repo.insertFilamentCatalog("material", input.name, null);
}

export async function removeColor(name: string): Promise<void> {
  await repo.deleteFilamentCatalog("color", name);
}

export async function removeBrand(name: string): Promise<void> {
  await repo.deleteFilamentCatalog("brand", name);
}

export async function removeMaterial(name: string): Promise<void> {
  await repo.deleteFilamentCatalog("material", name);
}

// Mapa refId -> colores usados (para la columna de color del listado de ventas).
export async function listSaleColors(): Promise<Record<string, string[]>> {
  const rows = await repo.getSaleColors();
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!r.refId) continue;
    (map[r.refId] ??= []).push(r.color);
  }
  for (const k of Object.keys(map))
    map[k] = [...new Set(map[k])].sort((a, b) => a.localeCompare(b, "es"));
  return map;
}
