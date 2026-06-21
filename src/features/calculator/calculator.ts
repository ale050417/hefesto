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
