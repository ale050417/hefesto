import { listOrdersAdmin } from "./orderAdminService";
import { listManualSales } from "./manualSaleService";
import type { OrderStatus } from "../types";

/**
 * Ventas UNIFICADAS (pedidos online + ventas manuales) para la API de la app
 * (2026-10-31). Misma fusión que arma la tabla de /admin/pedidos: ordenadas de
 * la más nueva a la más vieja. Se carga todo y se filtra acá (mismo patrón que
 * el tablero web): el volumen de una tienda chica no justifica paginar en DB.
 */
export type UnifiedSaleRow = {
  id: string;
  source: "online" | "manual";
  date: string;
  customerName: string | null;
  /** Qué se pidió (productos); en online el número queda en `ref`. */
  label: string;
  ref: string | null;
  paymentMethod: string;
  status: OrderStatus;
  total: number;
};

export async function listUnifiedSales(opts: {
  type?: "all" | "online" | "manual";
  status?: OrderStatus;
  q?: string;
  limit?: number;
}): Promise<{ items: UnifiedSaleRow[]; total: number }> {
  const type = opts.type ?? "all";
  const [online, manual] = await Promise.all([
    type === "manual"
      ? Promise.resolve([])
      : listOrdersAdmin({ page: 1, pageSize: 500 }).then((r) => r.items),
    type === "online" ? Promise.resolve([]) : listManualSales(),
  ]);

  let rows: UnifiedSaleRow[] = [
    ...online.map(
      (o): UnifiedSaleRow => ({
        id: o.id,
        source: "online",
        date: new Date(o.createdAt).toISOString(),
        customerName: o.customerName,
        label: o.itemsSummary || o.orderNumber,
        ref: o.orderNumber,
        paymentMethod: o.paymentMethod,
        status: o.status,
        total: o.total,
      }),
    ),
    ...manual.map(
      (s): UnifiedSaleRow => ({
        id: s.id,
        source: "manual",
        date: new Date(s.saleDate).toISOString(),
        customerName: s.customerName,
        label: s.detail ?? "",
        ref: null,
        paymentMethod: s.paymentMethod,
        status: s.status,
        total: Number(s.total),
      }),
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) =>
      [r.customerName, r.label, r.ref]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }

  const total = rows.length;
  return { items: rows.slice(0, opts.limit ?? 100), total };
}
