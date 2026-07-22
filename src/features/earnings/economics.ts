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
  /** Costo de insumos del producto por unidad (vaso, argollas...). Baja la
   * ganancia: el precio ya los incluye, así que se descuentan como costo. */
  extrasCost?: number;
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
    // El insumo del producto es un costo: se suma a la amortización (por unidad).
    amort += (a.total + (it.extrasCost ?? 0)) * it.quantity;
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
 * Economía de una venta manual / histórica. La amortización (costo) se carga con
 * la calculadora al registrar la venta; la ganancia pura = total − amortización
 * (nunca negativa) y es lo que entra al reparto entre socios.
 */
export function manualSaleEconomics(total: number, amort = 0): OrderEconomics {
  const a = Math.max(0, amort);
  return {
    ingreso: total,
    amort: a,
    gananciaPura: Math.max(0, total - a),
    grams: 0,
    hours: 0,
  };
}

/** Suma de porcentajes de los socios (debería dar 100). */
export function sharesTotal(shares: Array<{ pct: number }>): number {
  return shares.reduce((a, s) => a + (Number(s.pct) || 0), 0);
}

/**
 * Reparte una ganancia entre partes [{nombre, pct}] → [{nombre, monto}]. Puro.
 * Se usa tanto para los socios actuales (pedidos web) como para el reparto
 * guardado de cada venta manual.
 */
export function distribute(
  profit: number,
  parts: Array<{ name: string; pct: number }>,
): Array<{ name: string; amount: number }> {
  const p = Math.max(0, profit);
  return parts.map((part) => ({
    name: part.name,
    amount: (p * (Number(part.pct) || 0)) / 100,
  }));
}
