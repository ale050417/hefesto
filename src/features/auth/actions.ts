"use server";

import { redirect } from "next/navigation";
import { rateLimit } from "@/core/security/rate-limit";
import { getClientIp } from "@/core/security/request";
import { createClient } from "@/core/supabase/server";
import { siteUrl } from "@/lib/site";
import { loginSchema, registerSchema, resetRequestSchema } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

const TOO_MANY: Result = {
  ok: false,
  error: "Demasiados intentos. Esperá un minuto.",
};

export async function loginAction(input: unknown): Promise<Result> {
  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Email o contraseña incorrectos" };
  return { ok: true };
}

export async function registerAction(input: unknown): Promise<Result> {
  const ip = await getClientIp();
  if (!rateLimit(`register:${ip}`, { limit: 5, windowMs: 60_000 }).ok) {
    return TOO_MANY;
  }
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos" };
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
      error: "No se pudo crear la cuenta. Puede que el email ya esté en uso.",
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
  if (!parsed.success) return { ok: false, error: "Email inválido" };
  const supabase = await createClient();
  // Respuesta neutra (anti-enumeración, Cap. 13): no revelamos si existe.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/ingresar`,
  });
  return { ok: true };
}
