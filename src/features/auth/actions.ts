"use server";

import { z } from "zod";
import { getCurrentUser } from "@/core/auth/session";

import { redirect } from "next/navigation";
import { rateLimit } from "@/core/security/rate-limit";
import { getClientIp } from "@/core/security/request";
import { createClient } from "@/core/supabase/server";
import { siteUrl } from "@/lib/site";
import { clearMustChangePassword } from "./repository";
import { loginSchema, registerSchema, resetRequestSchema } from "./schemas";
import {
  isAcceptablePassword,
  PASSWORD_POLICY_MESSAGE,
} from "./password-strength";
import type { ActionResult } from "@/core/errors";

// Contrato canónico de la app (core/errors): { ok } | { ok:false, error:{code,message} }.
type Result = ActionResult;

const TOO_MANY: Result = {
  ok: false,
  error: {
    code: "RATE_LIMITED",
    message: "Demasiados intentos. Esperá un minuto.",
  },
};

export async function loginAction(input: unknown): Promise<Result> {
  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos" },
    };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Email o contraseña incorrectos",
      },
    };
  return { ok: true };
}

export async function registerAction(input: unknown): Promise<Result> {
  const ip = await getClientIp();
  if (!rateLimit(`register:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos" },
    };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/ingresar`,
    },
  });
  if (error) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message:
          "No se pudo crear la cuenta. Puede que el email ya esté en uso.",
      },
    };
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<Result> {
  const ip = await getClientIp();
  if (!rateLimit(`reset:${ip}`, { limit: 3, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Email inválido" },
    };
  const supabase = await createClient();
  // Respuesta neutra (anti-enumeración, Cap. 13): no revelamos si existe.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/ingresar`,
  });
  return { ok: true };
}

const changePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .refine(isAcceptablePassword, PASSWORD_POLICY_MESSAGE),
    confirmPassword: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(input: unknown): Promise<Result> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const ip = await getClientIp();
  if (!rateLimit(`changepw:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    // Mensaje específico (mínimo 8 / no coinciden), no genérico.
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: parsed.error.issues[0]?.message ?? "Revisá los datos",
      },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      ok: false,
      error: { code: "INTERNAL", message: "No se pudo cambiar la contraseña." },
    };
  // Limpia la marca de cambio obligatorio (invitados con contraseña temporal).
  try {
    await clearMustChangePassword(user.id);
  } catch (e) {
    console.error("[auth] no se pudo limpiar must_change_password:", e);
  }
  return { ok: true };
}
