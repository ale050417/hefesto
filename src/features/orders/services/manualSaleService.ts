import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { manualSales } from "@/core/db/schema";
import type { ManualSaleInput } from "../schemas";

export type ManualSale = typeof manualSales.$inferSelect;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Costos de la venta completa a partir del costo UNITARIO y la cantidad.
 * Puro y testeable (Cap. 15: toca dinero). La calculadora cotiza UNA pieza;
 * acá se escala: amortización total = unitaria × cantidad; ganancia = total −
 * amortización total (nunca negativa).
 */
export function computeManualSaleCosts(params: {
  unitAmortization: number;
  total: number;
  quantity: number;
}): { amortization: number; profit: number } {
  const qty = Math.max(1, Math.floor(params.quantity));
  const amortization = round2(Math.max(0, params.unitAmortization) * qty);
  const profit = round2(Math.max(0, params.total - amortization));
  return { amortization, profit };
}

/**
 * Mapea la entrada validada (Zod) a la fila de la base. Puro y testeable.
 * El total se guarda como string con 2 decimales (numeric). La fecha del input
 * (YYYY-MM-DD) se interpreta a mediodía local para evitar saltos de día por TZ.
 */
export function toManualSaleRow(
  input: ManualSaleInput,
  createdBy: string | null,
): typeof manualSales.$inferInsert {
  return {
    saleDate: new Date(`${input.saleDate}T12:00:00`),
    customerName: input.customerName,
    detail: input.detail ?? null,
    quantity: input.quantity,
    total: input.total.toFixed(2),
    amortization:
      input.amortization != null ? input.amortization.toFixed(2) : null,
    profit: input.profit != null ? input.profit.toFixed(2) : null,
    paymentMethod: input.paymentMethod,
    status: input.status,
    // Reparto de esta venta (solo partes con % > 0). Null = dividir por socios actuales.
    profitSplit:
      input.profitSplit && input.profitSplit.length > 0
        ? input.profitSplit.filter((p) => p.pct > 0)
        : null,
    createdBy,
  };
}

export async function createManualSale(
  input: ManualSaleInput,
  createdBy: string | null,
): Promise<ManualSale> {
  const [row] = await db
    .insert(manualSales)
    .values(toManualSaleRow(input, createdBy))
    .returning();
  if (!row) throw new Error("No se pudo registrar la venta manual");
  return row;
}

export async function listManualSales(): Promise<ManualSale[]> {
  return db.query.manualSales.findMany({
    orderBy: (m, { desc }) => [desc(m.saleDate)],
  });
}

/**
 * Borra una venta manual (cargada mal / duplicada). No tiene hijos ni toca
 * puntos/cupón/filamento: solo deja de sumar a facturación, ganancias y
 * reportes. La autorización (solo admin) se valida en la action.
 */
export async function deleteManualSale(id: string): Promise<void> {
  await db.delete(manualSales).where(eq(manualSales.id, id));
}
