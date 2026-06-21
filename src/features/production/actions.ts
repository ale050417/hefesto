"use server";

import { revalidatePath } from "next/cache";
import { isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import * as service from "./service";
import type { JobStatus, PrinterStatus } from "./repository";

const NOT_STAFF: ActionResult = {
  ok: false,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

export async function addPrinterAction(
  name: string,
  model: string,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  const trimmed = name.trim();
  if (trimmed.length < 2)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Nombre inválido." },
    };
  try {
    await service.createPrinter({ name: trimmed, model: model.trim() || null });
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}

export async function setPrinterStatusAction(
  id: string,
  status: PrinterStatus,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  try {
    await service.setPrinterStatus(id, status);
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}

export async function addJobAction(
  title: string,
  printerId: string,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  const trimmed = title.trim();
  if (trimmed.length < 2)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Título inválido." },
    };
  try {
    await service.createJob({ title: trimmed, printerId: printerId || null });
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}

export async function setJobStatusAction(
  id: string,
  status: JobStatus,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  try {
    await service.setJobStatus(id, status);
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}
