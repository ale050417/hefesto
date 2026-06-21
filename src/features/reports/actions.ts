"use server";

import { isStaff } from "@/core/auth/session";
import { getSalesCsv } from "./service";

export async function exportSalesCsvAction(
  fromISO: string,
  toISO: string,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  if (!(await isStaff())) return { ok: false, error: "No autorizado" };
  const csv = await getSalesCsv(new Date(fromISO), new Date(toISO));
  return { ok: true, csv };
}
