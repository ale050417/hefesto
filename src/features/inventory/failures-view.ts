/**
 * Listado de impresiones fallidas para la app (2026-10-31). Puro: el cálculo de
 * costo y los totales son los de `/admin/fallas` (costo = gramos / 1000 × costo
 * por kg del carrete que coincide en material+color; si no, el primero con ese
 * color; si no hay, 0).
 */

export type FailureInputRow = {
  id: string;
  createdAt: Date;
  pieceName: string;
  material: string | null;
  color: string | null;
  gramsLost: string | number;
  reason: string;
  notes: string | null;
  deducted: boolean;
};

export type FailureFilamentRef = {
  material: string;
  color: string;
  costPerKg: number;
};

export type FailureItem = {
  id: string;
  createdAt: string;
  pieceName: string;
  material: string;
  color: string;
  gramsLost: number;
  reason: string;
  notes: string | null;
  deducted: boolean;
  cost: number;
};

export type FailuresSummary = {
  count: number;
  totalGrams: number;
  totalCost: number;
  /** Causa más repetida (null si no hay fallas). */
  topReason: string | null;
  topReasonCount: number;
};

export function failureCostPerKg(
  filaments: FailureFilamentRef[],
  material: string | null,
  color: string | null,
): number {
  const exact = filaments.find(
    (f) => f.material === material && f.color === color,
  );
  if (exact) return exact.costPerKg;
  return filaments.find((f) => f.color === color)?.costPerKg ?? 0;
}

export function buildFailuresView(
  failures: FailureInputRow[],
  filaments: FailureFilamentRef[],
): { items: FailureItem[]; summary: FailuresSummary } {
  const items = failures.map((f): FailureItem => {
    const grams = Number(f.gramsLost);
    return {
      id: f.id,
      createdAt: f.createdAt.toISOString(),
      pieceName: f.pieceName,
      material: f.material ?? "",
      color: f.color ?? "",
      gramsLost: grams,
      reason: f.reason,
      notes: f.notes,
      deducted: f.deducted,
      cost: (grams / 1000) * failureCostPerKg(filaments, f.material, f.color),
    };
  });

  const byReason = new Map<string, number>();
  for (const i of items)
    byReason.set(i.reason, (byReason.get(i.reason) ?? 0) + 1);
  const top = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    items,
    summary: {
      count: items.length,
      totalGrams: items.reduce((a, i) => a + i.gramsLost, 0),
      totalCost: items.reduce((a, i) => a + i.cost, 0),
      topReason: top ? top[0] : null,
      topReasonCount: top ? top[1] : 0,
    },
  };
}
