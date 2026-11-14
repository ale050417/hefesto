import { NotFoundError, ValidationError } from "@/core/errors";
import { listFilamentsView } from "@/features/inventory/queries";
import { computeQuote, selectActiveMargin } from "./calculator";
import type { CalcSaveInput, QuotePriceInput } from "./schemas";
import * as service from "./service";

/**
 * Flujos de la calculadora compartidos entre las Server Actions de la web y la
 * API de la app (`/api/v1/admin/calculadora/*`, 2026-10-31). Antes vivían
 * inline en `actions.ts`; se extrajeron para que las dos puertas hagan lo mismo
 * (mismo cálculo `computeQuote`, mismas reglas). La AUTORIZACIÓN la valida cada
 * caller antes de llamar acá. Los errores de negocio salen como `AppError`
 * (ValidationError / NotFoundError) con su mensaje en castellano.
 */

/** El filamento elegido, por id (nunca por nombre: el costo/kg es de ESE carrete). */
async function requireFilament(filamentId: string) {
  const filaments = await listFilamentsView();
  const filament = filaments.find((f) => f.id === filamentId);
  if (!filament) {
    throw new ValidationError("El filamento elegido ya no existe. Elegí otro.");
  }
  return filament;
}

/** Guarda un cálculo en el historial. Devuelve el id de la fila nueva. */
export async function saveCalcFlow(
  input: CalcSaveInput,
  userId: string | null,
): Promise<{ id: string }> {
  // Costo/kg y snapshot material/color resueltos en el servidor desde el
  // FILAMENTO elegido (por id): dos filamentos del mismo material pueden
  // costar distinto (fix auditoría 2026-07).
  const filament = await requireFilament(input.filamentId);
  const row = await service.createCalc(
    { ...input, material: filament.material, color: filament.color },
    filament.costPerKg,
    userId,
  );
  return { id: row.id };
}

/** Cotización del OPERADOR: SOLO el precio final (el margen nunca sale). */
export async function quoteFinalPriceFlow(
  input: QuotePriceInput,
): Promise<{ precioFinal: number }> {
  const filament = await requireFilament(input.filamentId);
  const result = await service.quoteFinalPriceByPreset({
    presetId: input.presetId,
    grams: input.grams,
    hours: input.hours,
    costPerKg: filament.costPerKg,
  });
  if (!result) throw new NotFoundError("El tipo no está disponible.");
  return result;
}

/**
 * Cotización del ADMIN con el desglose completo (lo que la web calcula en el
 * navegador con `computeQuote`). Misma función, calculada en el servidor para
 * que la app no reimplemente la matemática.
 */
export async function quoteBreakdownFlow(input: QuotePriceInput) {
  const filament = await requireFilament(input.filamentId);
  const presets = await service.listMarginPresets();
  const marginPct = selectActiveMargin(presets, input.presetId);
  if (marginPct == null) throw new NotFoundError("El tipo no está disponible.");
  const cfg = await service.getCalcConfig();
  const quote = computeQuote({
    grams: input.grams,
    hours: input.hours,
    costPerKg: filament.costPerKg,
    kwhPrice: cfg.kwhPrice,
    machineWatts: cfg.machineWatts,
    machineLifeHours: cfg.machineLifeHours,
    maintenanceCost: cfg.maintenanceCost,
    marginErrorPct: cfg.marginErrorPct,
    marginPct,
  });
  return { quote, marginPct, costPerKg: filament.costPerKg };
}
