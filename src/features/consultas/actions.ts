"use server";

import { z } from "zod";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import * as flow from "./flow";
import {
  inquiryAnswerSchema,
  inquiryCreateSchema,
  inquiryStatusSchema,
} from "./schemas";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const idSchema = z.uuid();

function invalid(message: string, fields?: Record<string, string>) {
  return {
    ok: false as const,
    error: { code: "VALIDATION", message, ...(fields ? { fields } : {}) },
  };
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function currentActor(): Promise<flow.Actor | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, name: user.profile?.fullName ?? user.email ?? null };
}

/** Carga una consulta (las fotos se suben después, de a una). */
export async function createInquiryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("consultas", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsed = inquiryCreateSchema.safeParse(input);
  if (!parsed.success) {
    return invalid("Revisá los datos.", fieldErrors(parsed.error));
  }
  try {
    const row = await flow.createInquiry(parsed.data, actor);
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Sube UNA foto de referencia (FormData: inquiryId + file). */
export async function uploadInquiryImageAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await can("consultas", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const id = idSchema.safeParse(formData.get("inquiryId"));
  const file = formData.get("file");
  if (!id.success || !(file instanceof File)) return invalid("Falta la foto.");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return invalid("Formato no permitido (JPG, PNG o WebP)");
  }
  if (file.size > MAX_BYTES) return invalid("El archivo supera los 8 MB");
  try {
    await flow.addInquiryImage(
      id.data,
      Buffer.from(await file.arrayBuffer()),
      actor,
      await can("consultas", "editar"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Respuesta del operador (precio + datos → mensaje para el cliente). */
export async function answerInquiryAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("consultas", "editar"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  const parsed = inquiryAnswerSchema.safeParse(input);
  if (!parsedId.success) return invalid("Consulta inválida.");
  if (!parsed.success) {
    return invalid("Revisá los datos.", fieldErrors(parsed.error));
  }
  try {
    await flow.answerInquiry(parsedId.data, parsed.data, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Confirmar / no se hizo / reabrir (quien carga las consultas). */
export async function changeInquiryStatusAction(
  id: string,
  to: unknown,
): Promise<ActionResult> {
  if (!(await can("consultas", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  const parsed = inquiryStatusSchema.safeParse({ to });
  if (!parsedId.success || !parsed.success) return invalid("Estado inválido.");
  try {
    await flow.changeInquiryStatus(parsedId.data, parsed.data.to, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteInquiryAction(id: string): Promise<ActionResult> {
  // "ver" alcanza para entrar: el flujo decide si puede borrar ESTA consulta.
  if (!(await can("consultas", "ver"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Consulta inválida.");
  try {
    await flow.deleteInquiry(
      parsedId.data,
      actor,
      await can("consultas", "eliminar"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
