// Payload de Ganancias y socios para la app móvil (2026-10-31). Toma lo que
// devuelve `getEarningsOverview` (la MISMA fuente que /admin/ganancias, con
// `economics.ts` detrás) y lo deja listo para JSON. Puro, sin I/O.

import type { CostSettings } from "./economics";

/** Máximo de filas del desglose que viajan al celular (los totales son de TODAS). */
export const EARNINGS_ROWS_LIMIT = 300;

type OverviewInput = {
  settings: CostSettings;
  shares: Array<{
    id: string;
    name: string;
    role: string | null;
    pct: string | number;
  }>;
  rows: Array<{
    id: string;
    orderNumber: string;
    customerName: string | null;
    createdAt: Date;
    ingreso: number;
    amort: number;
    gananciaPura: number;
    grams: number;
    manual: boolean;
    split: Array<{ name: string; amount: number }>;
  }>;
  totals: { ingreso: number; amort: number; profit: number; grams: number };
  months: Array<{ value: string; label: string }>;
  selectedMonth: string;
  payouts: Array<{ name: string; amount: number }>;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Mes pedido por query: "YYYY-MM" o "all". Cualquier otra cosa → undefined
 * (el servicio cae al mes más nuevo con ventas, como la web). */
export function parseMonthParam(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  if (raw === "all") return "all";
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : undefined;
}

export function buildEarningsPayload(
  o: OverviewInput,
  limit: number = EARNINGS_ROWS_LIMIT,
) {
  const shares = o.shares.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    pct: num(s.pct),
  }));
  const rows = o.rows.slice(0, limit).map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    createdAt: r.createdAt.toISOString(),
    ingreso: num(r.ingreso),
    amort: num(r.amort),
    gananciaPura: num(r.gananciaPura),
    grams: num(r.grams),
    manual: r.manual,
    split: r.split.map((p) => ({ name: p.name, amount: num(p.amount) })),
  }));
  const ingreso = num(o.totals.ingreso);
  const profit = num(o.totals.profit);
  return {
    settings: {
      kwhPrice: num(o.settings.kwhPrice),
      machineWatts: num(o.settings.machineWatts),
      machineLifeHours: num(o.settings.machineLifeHours),
      maintenanceCost: num(o.settings.maintenanceCost),
    },
    shares,
    sharesTotal: shares.reduce((a, s) => a + s.pct, 0),
    totals: {
      ingreso,
      amort: num(o.totals.amort),
      profit,
      grams: num(o.totals.grams),
      orders: o.rows.length,
      // Mismo cálculo que la web: ganancia ÷ ingreso, entero.
      profitPct: ingreso > 0 ? Math.round((profit / ingreso) * 100) : 0,
    },
    months: o.months,
    selectedMonth: o.selectedMonth,
    payouts: o.payouts.map((p) => ({ name: p.name, amount: num(p.amount) })),
    rows,
    rowsTotal: o.rows.length,
    truncated: o.rows.length > rows.length,
  };
}
