"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import * as service from "./service";
import {
  addJobSchema,
  addPrinterSchema,
  idSchema,
  jobStatusSchema,
  printerStatusSchema,
} from "./schemas";

const NOT_STAFF: ActionResult = {
  ok: false,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

function validationError(message: string): ActionResult {
  return { ok: false, error: { code: "VALIDATION", message } };
}

export async function addPrinterAction(
  name: string,
  model: string,
): Promise<ActionResult> {
  if (!(await can("produccion", "crear"))) return NOT_STAFF;
  const parsed = addPrinterSchema.safeParse({ name, model });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Datos inválidos.",
    );
  }
  try {
    await service.createPrinter({
      name: parsed.data.name,
      model: parsed.data.model.trim() || null,
    });
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}

export async function setPrinterStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!(await can("produccion", "editar"))) return NOT_STAFF;
  const idOk = idSchema.safeParse(id);
  const statusOk = printerStatusSchema.safeParse(status);
  if (!idOk.success || !statusOk.success) {
    return validationError("Impresora o estado inválido.");
  }
  try {
    await service.setPrinterStatus(idOk.data, statusOk.data);
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
  if (!(await can("produccion", "crear"))) return NOT_STAFF;
  const parsed = addJobSchema.safeParse({ title, printerId });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Datos inválidos.",
    );
  }
  try {
    await service.createJob({
      title: parsed.data.title,
      printerId: parsed.data.printerId || null,
    });
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}

export async function setJobStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!(await can("produccion", "editar"))) return NOT_STAFF;
  const idOk = idSchema.safeParse(id);
  const statusOk = jobStatusSchema.safeParse(status);
  if (!idOk.success || !statusOk.success) {
    return validationError("Trabajo o estado inválido.");
  }
  try {
    await service.setJobStatus(idOk.data, statusOk.data);
    revalidatePath("/admin/produccion");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: toActionError(e) };
  }
}
