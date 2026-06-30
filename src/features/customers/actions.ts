"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import {
  addressSchema,
  adminNoteSchema,
  manualCustomerSchema,
  profileSchema,
} from "./schemas";
import * as service from "./service";

const NEED_AUTH = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
};

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado." },
};

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    await service.updateProfile(user.id, parsed.data);
    revalidatePath("/cuenta/perfil");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function addAddressAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    await service.addAddress(user.id, parsed.data);
    revalidatePath("/cuenta/perfil");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateAddressAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    await service.updateAddress(user.id, id, parsed.data);
    revalidatePath("/cuenta/perfil");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function setDefaultAddressAction(
  id: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  try {
    await service.setDefaultAddress(user.id, id);
    revalidatePath("/cuenta/perfil");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  try {
    await service.deleteAddress(user.id, id);
    revalidatePath("/cuenta/perfil");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ===================== Panel admin: clientes ===================== */

export async function createManualCustomerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return NEED_AUTH;
  if (!(await can("clientes", "crear"))) return NOT_STAFF;
  const parsed = manualCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    const c = await service.createManualCustomer(parsed.data, user.id);
    revalidatePath("/admin/clientes");
    return { ok: true, data: { id: c.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateManualCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("clientes", "editar"))) return NOT_STAFF;
  const parsed = manualCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    await service.updateManualCustomer(id, parsed.data);
    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateCustomerNoteAction(
  id: string,
  source: "registered" | "manual",
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("clientes", "editar"))) return NOT_STAFF;
  const parsed = adminNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Nota inválida." },
    };
  }
  try {
    await service.updateCustomerNote(id, source, parsed.data.note ?? null);
    revalidatePath(`/admin/clientes/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
