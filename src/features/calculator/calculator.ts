// Calculadora de precio de una pieza impresa en 3D (módulo puro, sin I/O).

export type CalcInput = {
  weightGrams: number; // peso de la pieza
  printHours: number; // tiempo de impresión
  materialCostPerKg: number; // costo del filamento por kg
  machineRatePerHour: number; // costo de máquina + luz por hora
  extraCost?: number; // insumos extra (pintura, tornillos, etc.)
  marginPct?: number; // margen de ganancia (%)
};

export type CalcResult = {
  materialCost: number;
  timeCost: number;
  extraCost: number;
  base: number;
  margin: number;
  price: number;
};

const clamp0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePrintPrice(input: CalcInput): CalcResult {
  const weight = clamp0(input.weightGrams);
  const hours = clamp0(input.printHours);
  const perKg = clamp0(input.materialCostPerKg);
  const perHour = clamp0(input.machineRatePerHour);
  const extra = clamp0(input.extraCost ?? 0);
  const marginPct = clamp0(input.marginPct ?? 0);

  const materialCost = (weight / 1000) * perKg;
  const timeCost = hours * perHour;
  const base = materialCost + timeCost + extra;
  const margin = base * (marginPct / 100);
  const price = base + margin;

  return {
    materialCost: round2(materialCost),
    timeCost: round2(timeCost),
    extraCost: round2(extra),
    base: round2(base),
    margin: round2(margin),
    price: round2(price),
  };
}

// --- Presupuesto detallado (espejo del index): material + luz + desgaste +
//     margen de error, luego margen de ganancia. ---

export type QuoteInput = {
  grams: number;
  hours: number; // tiempo total en horas
  costPerKg: number; // costo del filamento por kg
  kwhPrice: number;
  machineWatts: number;
  machineLifeHours: number;
  maintenanceCost: number;
  marginErrorPct: number; // % de margen de error sobre el costo
  marginPct: number; // % de ganancia
};

export type QuoteResult = {
  material: number;
  electricidad: number;
  desgaste: number;
  subtotal: number;
  margenError: number;
  costoTotal: number;
  ganancia: number;
  precioFinal: number;
  hours: number;
};

// Devuelve el margen (%) de un tipo de producto SOLO si existe y está activo;
// si no, null. Puro: la regla de negocio que elige el margen del tipo elegido.
// El margen vive en el servidor; el cliente nunca lo recibe (ver service).
export function selectActiveMargin(
  presets: Array<{ id: string; marginPct: number; active: boolean }>,
  presetId: string,
): number | null {
  const p = presets.find((x) => x.id === presetId && x.active);
  return p ? p.marginPct : null;
}

// --- Resolución del costo de material (fix auditoría 2026-07, bug "el precio
//     no cambia según el filamento") ---
//
// Antes el costo se buscaba por el string `material` (primer match): dos
// filamentos PLA (dorado $35.000 / blanco $25.000) colapsaban en un solo
// precio. Regla nueva, pura y testeable:
// 1. Con `filamentId` → el costo de ESE filamento (elegido en el selector).
// 2. Solo con `material` (productos, que no referencian un filamento único
//    porque pueden imprimirse en varios colores) → el costo MÁS CARO de ese
//    material: conservador, nunca subestima el costo.
// 3. Sin match → null (el caller decide rechazar; nunca más un 0 silencioso).
export type FilamentCostRef = {
  id: string;
  material: string;
  costPerKg: number;
};

export function resolveCostPerKg(
  filaments: FilamentCostRef[],
  by: { filamentId?: string | null; material?: string | null },
): number | null {
  if (by.filamentId) {
    const f = filaments.find((x) => x.id === by.filamentId);
    return f ? f.costPerKg : null;
  }
  if (by.material) {
    const matches = filaments.filter((x) => x.material === by.material);
    if (matches.length === 0) return null;
    return Math.max(...matches.map((x) => x.costPerKg));
  }
  return null;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const grams = clamp0(input.grams);
  const hours = clamp0(input.hours);
  const material = (grams / 1000) * clamp0(input.costPerKg);
  const electricidad =
    ((clamp0(input.machineWatts) * clamp0(input.kwhPrice)) / 1000) * hours;
  const desgaste =
    (clamp0(input.maintenanceCost) / Math.max(1, input.machineLifeHours)) *
    hours;
  const subtotal = material + electricidad + desgaste;
  const margenError = subtotal * (clamp0(input.marginErrorPct) / 100);
  const costoTotal = subtotal + margenError;
  const ganancia = costoTotal * (clamp0(input.marginPct) / 100);
  const precioFinal = costoTotal + ganancia;
  return {
    material: round2(material),
    electricidad: round2(electricidad),
    desgaste: round2(desgaste),
    subtotal: round2(subtotal),
    margenError: round2(margenError),
    costoTotal: round2(costoTotal),
    ganancia: round2(ganancia),
    precioFinal: round2(precioFinal),
    hours,
  };
}
