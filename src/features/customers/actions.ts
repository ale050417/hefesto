"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import { addressSchema, profileSchema } from "./schemas";
import * as service from "./service";

const NEED_AUTH = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
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
