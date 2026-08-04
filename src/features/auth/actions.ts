"use server";

import { z } from "zod";
import { getCurrentUser, invalidateProfileCache } from "@/core/auth/session";

import { redirect } from "next/navigation";
import { rateLimit } from "@/core/security/rate-limit";
import { getClientIp } from "@/core/security/request";
import { createClient } from "@/core/supabase/server";
import { siteUrl } from "@/lib/site";
import { clearMustChangePassword, getProfileRoleById } from "./repository";
import { loginSchema, registerSchema, resetRequestSchema } from "./schemas";
import {
  isAcceptablePassword,
  PASSWORD_POLICY_MESSAGE,
} from "./password-strength";
import type { ActionResult } from "@/core/errors";

// Contrato canónico de la app (core/errors): { ok } | { ok:false, error:{code,message} }.
type Result = ActionResult;

// Tipado como el "brazo" ok:false puro (sin fijarlo a Result completo): ese
// brazo es igual para cualquier ActionResult<T>, así se puede devolver tal
// cual desde loginAction (ActionResult<{isStaff}>) y del resto (Result) sin
// que TS se queje de que falta `data` (bug de build 2026-07-28: anotar esto
// como `Result` fijaba el tipo a la unión completa, incluido el brazo
// `{ok:true}` sin data, que no encaja en ActionResult<{isStaff:boolean}>).
const TOO_MANY: { ok: false; error: { code: string; message: string } } = {
  ok: false,
  error: {
    code: "RATE_LIMITED",
    message: "Demasiados intentos. Esperá un minuto.",
  },
};

export async function loginAction(
  input: unknown,
): Promise<ActionResult<{ isStaff: boolean }>> {
  const ip = await getClientIp();
  if (!(await rateLimit(`login:${ip}`, { limit: 5, windowMs: 60_000 })).ok) {
    return TOO_MANY;
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos" },
    };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error)
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Email o contraseña incorrectos",
      },
    };
  // Staff → el destino natural es el PANEL (2026-07-24, pedido de Ale: al
  // loguearse un miembro del equipo va directo a /admin, no a la tienda).
  let isStaff = false;
  try {
    const role = data.user?.id ? await getProfileRoleById(data.user.id) : null;
    isStaff = role === "admin" || role === "operator";
  } catch {
    // Sin rol legible: queda el destino normal de la tienda.
  }
  return { ok: true, data: { isStaff } };
}

export async function registerAction(input: unknown): Promise<Result> {
  const ip = await getClientIp();
  if (!(await rateLimit(`register:${ip}`, { limit: 5, windowMs: 60_000 })).ok) {
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
  // El estado local (carrito, favoritos) lo limpia el botón antes de enviar,
  // así no hace falta un revalidatePath("/", "layout") acá: ese barrido tira
  // también el caché de la vidriera y dejaría el sitio frío para todos.
  redirect("/");
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<Result> {
  const ip = await getClientIp();
  if (!(await rateLimit(`reset:${ip}`, { limit: 3, windowMs: 60_000 })).ok) {
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
  if (!(await rateLimit(`changepw:${ip}`, { limit: 5, windowMs: 60_000 })).ok) {
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
    // El perfil está cacheado 60 s: sin esto, el guard seguía viendo la marca
    // vieja y devolvía al recién invitado a "Creá tu contraseña" en loop.
    invalidateProfileCache(user.id);
  } catch (e) {
    console.error("[auth] no se pudo limpiar must_change_password:", e);
  }
  return { ok: true };
}

const acceptInviteSchema = z.object({
  tokenHash: z.string().min(10).max(500),
  type: z.enum(["invite", "magiclink"]),
});

/**
 * Acepta una invitación al equipo (2026-07-24): verifica el token de UN SOLO
 * USO y abre sesión. Se dispara desde el BOTÓN de /equipo/aceptar — no desde
 * el GET del link — porque los escáneres de seguridad de Gmail/Outlook visitan
 * los links de los correos y quemaban el token antes de que la persona lo
 * tocara. El token recién se consume con un click humano.
 */
export async function acceptTeamInviteAction(input: unknown): Promise<Result> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "El link de invitación no es válido.",
      },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: parsed.data.type,
    token_hash: parsed.data.tokenHash,
  });
  if (error) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message:
          "El link venció o ya se usó. Pedile al administrador que reenvíe la invitación.",
      },
    };
  }
  return { ok: true };
}
