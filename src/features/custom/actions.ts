"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isStaff } from "@/core/auth/session";
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
    });
    revalidatePath(`/cuenta/a-medida/${requestId}`);
    revalidatePath(`/admin/medida/${requestId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function quoteCustomRequestAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await isStaff()))
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
  if (!(await isStaff()))
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
