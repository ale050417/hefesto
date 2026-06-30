"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { customRequestSchema, messageSchema, quoteSchema } from "./schemas";
import * as service from "./service";
import * as repo from "./repository";
import type { CustomRequestStatus } from "./types";

export async function createCustomRequestAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const parsed = customRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  try {
    const r = await service.createCustomRequest(user.id, parsed.data);
    revalidatePath("/cuenta/a-medida");
    return { ok: true, data: { id: r.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function sendCustomMessageAction(
  requestId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Escribí un mensaje." },
    };
  const staff = await isStaff();
  try {
    const request = await repo.getRequestById(requestId);
    if (!request || (!staff && request.customerId !== user.id)) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "No encontrada." },
      };
    }
    await service.sendMessage({
      requestId,
      fromStaff: staff,
      authorId: user.id,
      body: parsed.data.body,
      imageUrl: parsed.data.imageUrl || null,
    });
    revalidatePath(`/cuenta/a-medida/${requestId}`);
    revalidatePath(`/cuenta/a-medida`);
    revalidatePath(`/admin/medida`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Sube una foto del chat (cliente dueño o staff) y devuelve su URL pública. */
export async function uploadCustomChatImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const requestId = formData.get("requestId");
  const file = formData.get("file");
  if (typeof requestId !== "string") {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Solicitud inválida." },
    };
  }
  if (!(file instanceof File)) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Falta el archivo." },
    };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Formato no permitido (JPG, PNG o WebP).",
      },
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "El archivo supera los 8 MB." },
    };
  }
  const staff = await isStaff();
  try {
    const request = await repo.getRequestById(requestId);
    if (!request || (!staff && request.customerId !== user.id)) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "No encontrada." },
      };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await service.uploadChatImage(requestId, bytes);
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin: elimina una conversación a medida (y sus mensajes por cascade). */
export async function deleteCustomRequestAction(
  id: string,
): Promise<ActionResult> {
  if (!(await can("medida", "eliminar")))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await service.deleteRequest(id);
    revalidatePath("/admin/medida");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function quoteCustomRequestAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("medida", "editar")))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Monto inválido." },
    };
  try {
    await service.quoteRequest(id, parsed.data.amount);
    revalidatePath(`/admin/medida/${id}`);
    revalidatePath("/admin/medida");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function transitionCustomRequestAction(
  id: string,
  toStatus: CustomRequestStatus,
): Promise<ActionResult> {
  if (!(await can("medida", "editar")))
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  try {
    await service.transitionRequest(id, toStatus);
    revalidatePath(`/admin/medida/${id}`);
    revalidatePath("/admin/medida");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function approveQuoteAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  try {
    await service.approveQuote(id, user.id);
    revalidatePath(`/cuenta/a-medida/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
