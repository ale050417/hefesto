"use server";

import { can } from "@/core/auth/permissions";
import { getSalesCsv } from "./service";

export async function exportSalesCsvAction(
  fromISO: string,
  toISO: string,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  if (!(await can("reportes", "ver")))
    return { ok: false, error: "No autorizado" };
  const csv = await getSalesCsv(new Date(fromISO), new Date(toISO));
  return { ok: true, csv };
}
