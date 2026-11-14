import * as repo from "./repository";
import { fillDailySeries, sumDailySeries, type RevenuePoint } from "./service";

/**
 * Serie de ingresos por día de los últimos `days` días (tienda + ventas
 * manuales, mismo criterio que la curva del inicio y /admin/reportes). La usa
 * el selector de rango de la app; reutiliza las funciones puras del service.
 */
export async function getRevenueSeries(days: number): Promise<RevenuePoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const [online, manual] = await Promise.all([
    repo.getRevenueByDay(since),
    repo.getManualRevenueByDay(since),
  ]);
  return fillDailySeries(sumDailySeries(online, manual), days);
}
