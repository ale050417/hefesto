import * as repo from "./repository";
import {
  computeOrderEconomics,
  manualSaleEconomics,
  type CostSettings,
  type EconItem,
} from "./economics";
import type { CostSettingsInput, ProfitShareInput } from "./schemas";

const DEFAULTS: CostSettings = {
  kwhPrice: 95,
  machineWatts: 220,
  machineLifeHours: 8000,
  maintenanceCost: 320000,
};

export async function getCostSettings(): Promise<CostSettings> {
  const row = await repo.getCostSettingsRow();
  if (!row) return DEFAULTS;
  return {
    kwhPrice: Number(row.kwhPrice),
    machineWatts: row.machineWatts,
    machineLifeHours: row.machineLifeHours,
    maintenanceCost: Number(row.maintenanceCost),
  };
}

export async function saveCostSettings(input: CostSettingsInput) {
  return repo.upsertCostSettings({
    kwhPrice: String(input.kwhPrice),
    machineWatts: input.machineWatts,
    machineLifeHours: input.machineLifeHours,
    maintenanceCost: String(input.maintenanceCost),
  });
}

export async function listProfitShares() {
  return repo.listProfitShares();
}

export async function createProfitShare(input: ProfitShareInput) {
  return repo.insertProfitShare({
    name: input.name,
    role: input.role ?? null,
    pct: String(input.pct),
  });
}

export async function updateProfitShare(id: string, input: ProfitShareInput) {
  return repo.updateProfitShareRow(id, {
    name: input.name,
    role: input.role ?? null,
    pct: String(input.pct),
  });
}

export async function deleteProfitShare(id: string) {
  return repo.deleteProfitShareRow(id);
}

export type EarningsOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  createdAt: Date;
  ingreso: number;
  amort: number;
  gananciaPura: number;
  grams: number;
  /** true si proviene de una venta manual / histórica (sin items ni costo). */
  manual: boolean;
};

// Mes (YYYY-MM) de una fecha, en horario de Argentina, para agrupar/filtrar.
const TZ = "America/Argentina/Buenos_Aires";
function monthKey(d: Date): string {
  return d
    .toLocaleDateString("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .slice(0, 7);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type EarningsMonth = { value: string; label: string };

/**
 * Datos del panel Ganancias y socios: economía por pedido + totales + socios.
 * `month` (YYYY-MM) filtra el período; si es vacío/inválido, muestra todo.
 */
export async function getEarningsOverview(month?: string | null) {
  const [settings, shares, ords, items, costMap, manual] = await Promise.all([
    getCostSettings(),
    repo.listProfitShares(),
    repo.getDeliveredOrders(),
    repo.getDeliveredItems(),
    repo.getFilamentCostByMaterial(),
    repo.getDeliveredManualSales(),
  ]);

  const byOrder = new Map<string, EconItem[]>();
  for (const it of items) {
    const costPerKg = it.material ? (costMap.get(it.material) ?? 0) : 0;
    const arr = byOrder.get(it.orderId) ?? [];
    arr.push({
      quantity: it.quantity,
      weightGrams: it.weightGrams,
      printMinutes: it.printMinutes,
      costPerKg,
    });
    byOrder.set(it.orderId, arr);
  }

  const orderRows: EarningsOrderRow[] = ords.map((o) => {
    const e = computeOrderEconomics(o.total, byOrder.get(o.id) ?? [], settings);
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      createdAt: o.createdAt,
      ingreso: e.ingreso,
      amort: e.amort,
      gananciaPura: e.gananciaPura,
      grams: e.grams,
      manual: false,
    };
  });

  // Ventas manuales cobradas: entran al reparto con amortización 0 (sin costo).
  const manualRows: EarningsOrderRow[] = manual.map((m) => {
    const e = manualSaleEconomics(m.total);
    return {
      id: m.id,
      orderNumber: "Venta manual",
      customerName: m.customerName,
      createdAt: m.createdAt,
      ingreso: e.ingreso,
      amort: e.amort,
      gananciaPura: e.gananciaPura,
      grams: e.grams,
      manual: true,
    };
  });

  const allRows: EarningsOrderRow[] = [...orderRows, ...manualRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  // Meses disponibles (los que tienen al menos una venta), más nuevo primero.
  const monthsPresent = new Set<string>();
  for (const r of allRows) monthsPresent.add(monthKey(r.createdAt));
  const months: EarningsMonth[] = [...monthsPresent]
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: monthLabel(value) }));

  // Filtro de mes (solo si el valor pedido existe en los datos).
  const selectedMonth =
    month && months.some((m) => m.value === month) ? month : "";
  const rows = selectedMonth
    ? allRows.filter((r) => monthKey(r.createdAt) === selectedMonth)
    : allRows;

  const totals = rows.reduce(
    (a, r) => ({
      ingreso: a.ingreso + r.ingreso,
      amort: a.amort + r.amort,
      profit: a.profit + r.gananciaPura,
      grams: a.grams + r.grams,
    }),
    { ingreso: 0, amort: 0, profit: 0, grams: 0 },
  );

  return { settings, shares, rows, totals, months, selectedMonth };
}
