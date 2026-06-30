// Economía por pedido (módulo puro, testeable): amortización (material + luz +
// desgaste de máquina) y ganancia pura. Espejo de la fórmula del index.

export type CostSettings = {
  kwhPrice: number;
  machineWatts: number;
  machineLifeHours: number;
  maintenanceCost: number;
};

export type Amort = {
  material: number;
  electricidad: number;
  desgaste: number;
  total: number;
  grams: number;
  hours: number;
};

/**
 * Costo de producir UNA unidad de un producto.
 * - material: gramos × costo/kg del filamento.
 * - electricidad: watts × precio kWh × horas.
 * - desgaste: (costo mantenimiento / vida útil horas) × horas.
 * Si no hay tiempo de impresión, se estima ~22 g/h.
 */
export function productAmort(
  weightGrams: number,
  printMinutes: number,
  costPerKg: number,
  s: CostSettings,
): Amort {
  const grams = weightGrams > 0 ? weightGrams : 0;
  const material = (grams / 1000) * Math.max(0, costPerKg);
  const hours =
    printMinutes > 0
      ? printMinutes / 60
      : grams > 0
        ? Math.max(0.5, grams / 22)
        : 0;
  const electricidad = ((s.machineWatts * s.kwhPrice) / 1000) * hours;
  const desgaste =
    (s.maintenanceCost / Math.max(1, s.machineLifeHours)) * hours;
  return {
    material,
    electricidad,
    desgaste,
    total: material + electricidad + desgaste,
    grams,
    hours,
  };
}

export type EconItem = {
  quantity: number;
  weightGrams: number;
  printMinutes: number;
  costPerKg: number;
};

export type OrderEconomics = {
  ingreso: number;
  amort: number;
  gananciaPura: number;
  grams: number;
  hours: number;
};

/** Economía de un pedido: suma la amortización de sus items y la resta del total. */
export function computeOrderEconomics(
  total: number,
  items: EconItem[],
  s: CostSettings,
): OrderEconomics {
  let amort = 0;
  let grams = 0;
  let hours = 0;
  for (const it of items) {
    const a = productAmort(it.weightGrams, it.printMinutes, it.costPerKg, s);
    amort += a.total * it.quantity;
    grams += a.grams * it.quantity;
    hours += a.hours * it.quantity;
  }
  return {
    ingreso: total,
    amort,
    gananciaPura: Math.max(0, total - amort),
    grams,
    hours,
  };
}

/**
 * Economía de una venta manual / histórica. No tiene items ni datos de costo
 * (peso/material/tiempo), así que no hay amortización calculable: el total se
 * toma como ganancia pura. De este modo entra al reparto entre socios igual que
 * un pedido entregado (espejo del index, que las cuenta con amort = 0).
 */
export function manualSaleEconomics(total: number): OrderEconomics {
  return {
    ingreso: total,
    amort: 0,
    gananciaPura: Math.max(0, total),
    grams: 0,
    hours: 0,
  };
}

/** Suma de porcentajes de los socios (debería dar 100). */
export function sharesTotal(shares: Array<{ pct: number }>): number {
  return shares.reduce((a, s) => a + (Number(s.pct) || 0), 0);
}
