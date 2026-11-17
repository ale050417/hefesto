"use server";

import { z } from "zod";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { fixCreateSchema, fixUpdateSchema } from "./schemas";
import * as service from "./service";

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

async function currentActor() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, name: user.profile?.fullName ?? user.email ?? null };
}

/** Carga un arreglo (sin fotos: se suben después, de a una). */
export async function createFixAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("arreglos", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsed = fixCreateSchema.safeParse(input);
  if (!parsed.success) {
    return invalid("Revisá los datos.", fieldErrors(parsed.error));
  }
  try {
    const fix = await service.createFix(parsed.data, actor);
    return { ok: true, data: { id: fix.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Sube UNA foto a un arreglo (FormData: fixId + file). De a una por llamada:
 * el tope de 8 MB de las Server Actions es por request entero.
 */
export async function uploadFixImageAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await can("arreglos", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const fixId = idSchema.safeParse(formData.get("fixId"));
  const file = formData.get("file");
  if (!fixId.success || !(file instanceof File)) {
    return invalid("Falta la foto.");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return invalid("Formato no permitido (JPG, PNG o WebP)");
  }
  if (file.size > MAX_BYTES) return invalid("El archivo supera los 8 MB");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await service.addFixImage(
      fixId.data,
      bytes,
      actor,
      await can("arreglos", "editar"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Cambia el estado y la respuesta (dueño, o quien tenga "editar"). */
export async function updateFixAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("arreglos", "editar"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  const parsed = fixUpdateSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return invalid(
      "Revisá los datos.",
      parsed.success ? undefined : fieldErrors(parsed.error),
    );
  }
  try {
    await service.updateFix(parsedId.data, parsed.data, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteFixAction(id: string): Promise<ActionResult> {
  // "ver" alcanza para entrar: el service decide si puede borrar ESTE arreglo
  // (permiso "eliminar", o es suyo y sigue pendiente).
  if (!(await can("arreglos", "ver"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Arreglo inválido.");
  try {
    await service.deleteFix(
      parsedId.data,
      actor,
      await can("arreglos", "eliminar"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
