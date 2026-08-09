import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  createInviteToken,
  createLoginToken,
  getUserEmail,
  listAuthUsers,
  setUserPassword,
} from "@/core/supabase/admin";
import { buildTeamInviteEmail, buildTeamPromotedEmail } from "./emails";
import { env } from "@/core/config/env";
import { isEmailConfigured, sendEmail } from "@/core/email";
import { DEFAULT_OPERATOR } from "@/core/auth/perm-defs";
import { invalidateProfileCache } from "@/core/auth/session";
import { ValidationError } from "@/core/errors";
import * as repo from "./repository";
import {
  deleteBannerRow,
  getSettings,
  insertBanner,
  listActiveBanners,
  listBanners,
  updateBannerRow,
  upsertSettings,
} from "./repository";
import type {
  BrandSettings,
  BusinessMode,
  BusinessSettings,
  PaymentSettings,
  Role,
  ShippingSettings,
  StoreBanner,
  TeamMember,
} from "./types";

// Marca (logo, nombre, redes…) del shell público. Cacheada 60 s CROSS-request
// con unstable_cache. Antes era React cache(), que solo deduplica DENTRO de un
// request → golpeaba la DB en CADA visita de CADA página y saturaba el pooler.
// El admin ve sus cambios propagados en ≤60 s, igual que la vidriera.
export const getBrandSettings = unstable_cache(
  async (): Promise<BrandSettings> => {
    // Resiliente: si la consulta falla (p. ej. una columna nueva todavía sin
    // migrar, o la DB no responde), devolvemos los valores por defecto en vez de
    // tirar toda la tienda/preview. Degrada, no cae (mismo criterio que el resto).
    const s = await getSettings().catch((error) => {
      console.error("[settings] getBrandSettings falló, uso defaults:", error);
      return null;
    });
    return {
      logoUrl: s?.logoUrl ?? null,
      heroImageUrl: s?.heroImageUrl ?? null,
      storeName: s?.storeName ?? null,
      slogan: s?.slogan ?? null,
      whatsapp: s?.whatsapp ?? null,
      instagram: s?.instagram ?? null,
      facebook: s?.facebook ?? null,
      contactEmail: s?.contactEmail ?? null,
      businessMode: s?.businessMode === "vidriera" ? "vidriera" : "checkout",
      accentColor: s?.accentColor ?? null,
      season: s?.season ?? "none",
      seasonDeco: s?.seasonDeco ?? false,
      seasonIntensity: s?.seasonIntensity ?? 16,
      seasonDurationSec: s?.seasonDurationSec ?? 0,
      homeSections: s?.homeSections ?? null,
      trustBar: s?.trustBar ?? null,
      faq: s?.faq ?? null,
      gallery: s?.gallery ?? null,
      bannerIntervalSec: s?.bannerIntervalSec ?? 5,
    };
  },
  ["brand-settings-public"],
  { revalidate: 60 },
);

// Info del footer (incluye description y addressText, que no van en la marca).
// Cacheada 60 s como el resto del shell; separada de getBusinessSettings, que el
// admin necesita fresca.
export const getPublicStoreInfo = unstable_cache(
  async () => {
    const s = await getSettings();
    return {
      logoUrl: s?.logoUrl ?? null,
      storeName: s?.storeName ?? null,
      slogan: s?.slogan ?? null,
      description: s?.description ?? null,
      whatsapp: s?.whatsapp ?? null,
      instagram: s?.instagram ?? null,
      contactEmail: s?.contactEmail ?? null,
      addressText: s?.addressText ?? null,
    };
  },
  ["public-store-info"],
  { revalidate: 60 },
);

// Configuración completa (para el panel del admin).
export const getBusinessSettings = cache(
  async (): Promise<BusinessSettings | null> => {
    return getSettings();
  },
);

export async function setBrandImage(
  kind: "logo" | "hero",
  url: string,
): Promise<void> {
  await upsertSettings(
    kind === "logo" ? { logoUrl: url } : { heroImageUrl: url },
  );
}

export type BusinessInfoPatch = {
  storeName?: string | null;
  slogan?: string | null;
  description?: string | null;
  whatsapp?: string | null;
  contactEmail?: string | null;
  addressText?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  cuit?: string | null;
  hours?: BusinessSettings["hours"];
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
};

export async function saveBusinessInfo(
  patch: BusinessInfoPatch,
): Promise<void> {
  await upsertSettings(patch);
}

/* ---------- Métodos de pago ---------- */

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  return repo.getPaymentSettings();
}

export async function savePaymentSettings(patch: {
  transferEnabled: boolean;
  transferAlias: string | null;
  transferCbu: string | null;
  mpEnabled: boolean;
  mpNote: string | null;
  cashEnabled: boolean;
  cashNote: string | null;
}): Promise<void> {
  await repo.upsertPaymentSettings(patch);
}

/**
 * Guarda (o borra con null) el Access Token de MercadoPago del vendedor.
 * SECRETO: server-only. No lo devolvemos nunca al cliente.
 */
export async function saveMpAccessToken(token: string | null): Promise<void> {
  await repo.upsertPaymentSettings({ mpAccessToken: token });
}

/* ---------- Envíos ---------- */

export async function getShippingSettings(): Promise<ShippingSettings | null> {
  return repo.getShippingSettings();
}

export async function saveShippingSettings(patch: {
  city: string | null;
  freeOver: number;
  outMsg: string | null;
  zones: Array<{ name: string; price: number }>;
}): Promise<void> {
  await repo.upsertShippingSettings({
    city: patch.city,
    freeOver: String(patch.freeOver),
    outMsg: patch.outMsg,
    zones: patch.zones,
  });
}

/* ---------- Roles personalizados (CRUD con salvaguardas) ---------- */

/**
 * Garantiza que existan los roles de sistema (Administrador / Operador). Se
 * llama de forma perezosa al listar, así no depende de correr un seed a mano.
 * Idempotente (no duplica). Si la tabla aún no existe (falta migrar), no rompe.
 */
const ensureSystemRoles = cache(async (): Promise<void> => {
  try {
    // SELECT barato: solo insertamos si falta (evita escribir/lockear en cada
    // carga). `cache` dedupe: aunque listTeam y listRoles lo llamen en paralelo,
    // corre UNA vez por request (sin inserts concurrentes que se traben).
    const existing = await repo.listRoles();
    const names = new Set(existing.map((r) => r.name));
    if (!names.has("Administrador")) {
      await repo.ensureSystemRole({
        name: "Administrador",
        permissions: {},
        isAdmin: true,
      });
    }
    if (!names.has("Operador")) {
      await repo.ensureSystemRole({
        name: "Operador",
        permissions: DEFAULT_OPERATOR as unknown as Record<string, string[]>,
        isAdmin: false,
      });
    }
  } catch (error) {
    console.error(
      "[roles] no se pudieron asegurar los roles de sistema:",
      error,
    );
  }
});

export async function listRoles() {
  await ensureSystemRoles();
  return repo.listRoles();
}

export async function createRole(input: {
  name: string;
  permissions: Record<string, string[]>;
}) {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Ingresá un nombre para el rol.");
  const existing = await repo.listRoles();
  if (existing.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    throw new ValidationError("Ya existe un rol con ese nombre.");
  }
  return repo.insertRole({ name, permissions: input.permissions });
}

export async function updateRole(
  id: string,
  input: { name: string; permissions: Record<string, string[]> },
) {
  const role = await repo.getRoleById(id);
  if (!role) throw new ValidationError("Rol no encontrado.");
  // El rol Administrador es acceso total por definición: no se edita.
  // El resto (incluido el "Operador" de sistema) sí se puede ajustar.
  if (role.isAdmin) {
    throw new ValidationError(
      "El rol Administrador tiene acceso total y no se edita.",
    );
  }
  const name = input.name.trim();
  if (!name) throw new ValidationError("Ingresá un nombre para el rol.");
  return repo.updateRoleRow(id, { name, permissions: input.permissions });
}

export async function deleteRole(id: string) {
  const role = await repo.getRoleById(id);
  if (!role) throw new ValidationError("Rol no encontrado.");
  if (role.isSystem) {
    throw new ValidationError("Los roles de sistema no se pueden borrar.");
  }
  const inUse = await repo.countProfilesWithRole(id);
  if (inUse > 0) {
    throw new ValidationError(
      `No se puede borrar: ${inUse} ${inUse === 1 ? "persona lo tiene" : "personas lo tienen"} asignado.`,
    );
  }
  await repo.deleteRoleRow(id);
}

/* ---------- Equipo de gestión (staff con acceso al panel) ---------- */

const STAFF_ROLES = ["admin", "operator"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Miembros del equipo = perfiles staff (admin/operador) cruzados con auth para
 * email y estado. "invitado" = fue invitado y todavía no inició sesión.
 */
export async function listTeam(): Promise<TeamMember[]> {
  await ensureSystemRoles();
  const [profiles, auth, allRoles] = await Promise.all([
    repo.listProfilesByRoles([...STAFF_ROLES]),
    listAuthUsers(),
    repo.listRoles(),
  ]);
  const roleName = new Map(allRoles.map((r) => [r.id, r.name]));
  return profiles.map((p) => {
    const a = auth.get(p.id);
    // Pendiente = todavía NO creó su propia contraseña (aunque haya abierto el
    // link). Así "Reenviar invitación" queda disponible hasta completar el
    // alta de verdad (fix 2026-07-24: antes con solo tocar el link pasaba a
    // "activo" sin contraseña y sin forma de volver a entrar).
    const pending =
      p.mustChangePassword || (!!a?.invitedAt && !a?.lastSignInAt);
    return {
      id: p.id,
      fullName: p.fullName,
      email: a?.email ?? null,
      role: p.role as StaffRole,
      roleId: p.roleId ?? null,
      roleName: p.roleId ? (roleName.get(p.roleId) ?? null) : null,
      status: pending ? "invitado" : "activo",
    };
  });
}

/** Contraseña temporal legible (sin caracteres ambiguos). Criptográficamente aleatoria. */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let p = "Hef-";
  for (const b of bytes) p += chars[b % chars.length];
  return p;
}

/** El enum de acceso se deriva del rol: admin si es el rol full, si no operador. */
function enumForRole(role: Role): StaffRole {
  return role.isAdmin ? "admin" : "operator";
}

/**
 * Invita a un miembro por LINK SEGURO (2026-07-24, reemplaza a la contraseña
 * temporal): Supabase crea la cuenta SIN contraseña y genera un token de un
 * solo uso con expiración; el correo (Resend, plantilla propia + mensaje del
 * admin) lleva a /equipo/aceptar, que verifica el token y lo manda a CREAR su
 * contraseña — que solo esa persona conoce; el admin nunca la ve.
 *
 * Si el email ya era CLIENTE de la tienda, se lo PROMUEVE al equipo con su
 * misma cuenta y contraseña (decisión de Ale) y se le avisa por correo.
 * La autorización (admin) va en la action.
 */
export async function inviteTeamMember(input: {
  email: string;
  roleId: string;
  fullName?: string | null;
  message?: string | null;
}): Promise<{ email: string; promoted: boolean }> {
  // Sin Resend configurado, sendEmail se OMITE en silencio → parecía enviado
  // pero no llegaba nada (bug 2026-07-24). Mejor frenar con un error claro.
  if (!isEmailConfigured()) {
    throw new ValidationError(
      "Falta configurar el envío de correos (RESEND_API_KEY): la invitación no se puede mandar.",
    );
  }
  const role = await repo.getRoleById(input.roleId);
  if (!role) throw new ValidationError("Elegí un rol válido.");
  const email = input.email.trim().toLowerCase();

  // ¿Ya existe la cuenta? Tres casos: nunca entró (re-invitar con link nuevo),
  // cliente con cuenta activa (promover) o ya es staff (rechazar).
  const authUsers = await listAuthUsers();
  let existingId: string | null = null;
  let existingInfo: { lastSignInAt: string | null } | null = null;
  for (const [id, info] of authUsers) {
    if (info.email?.toLowerCase() === email) {
      existingId = id;
      existingInfo = info;
      break;
    }
  }
  if (existingId && existingInfo?.lastSignInAt == null) {
    // Cuenta creada por una invitación previa que nunca se aceptó (p. ej. el
    // primer intento sin Resend): rol al día + link NUEVO de un solo uso.
    await repo.upsertProfile({
      id: existingId,
      fullName: input.fullName ?? null,
      role: enumForRole(role),
      roleId: role.id,
      mustChangePassword: true,
    });
    invalidateProfileCache(existingId);
    const { tokenHash, error } = await createLoginToken(email);
    if (error || !tokenHash) {
      throw new ValidationError(error ?? "No se pudo generar el link.");
    }
    const acceptUrl = `${env.NEXT_PUBLIC_SITE_URL}/equipo/aceptar?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    const mail = buildTeamInviteEmail({
      roleName: role.name,
      message: input.message ?? null,
      acceptUrl,
    });
    try {
      await sendEmail({ to: email, ...mail });
    } catch (mailError) {
      const detail =
        mailError instanceof Error ? mailError.message : String(mailError);
      throw new ValidationError(`Falló el envío del correo: ${detail}`);
    }
    return { email, promoted: false };
  }
  if (existingId) {
    const current = await repo.getProfileRole(existingId);
    if (current === "admin" || current === "operator") {
      throw new ValidationError(
        "Ese email ya es parte del equipo. Si tiene la invitación pendiente, usá 'Reenviar invitación' en la lista.",
      );
    }
    await repo.upsertProfile({
      id: existingId,
      fullName: input.fullName ?? null,
      role: enumForRole(role),
      roleId: role.id,
      // Conserva SU contraseña: no hay nada que crear.
      mustChangePassword: false,
    });
    invalidateProfileCache(existingId);
    try {
      const mail = buildTeamPromotedEmail({
        roleName: role.name,
        message: input.message ?? null,
        panelUrl: `${env.NEXT_PUBLIC_SITE_URL}/admin`,
      });
      await sendEmail({ to: email, ...mail });
    } catch (error) {
      // El acceso ya quedó dado; el aviso es best-effort.
      console.error("[email] no se pudo avisar la promoción:", error);
    }
    return { email, promoted: true };
  }

  const { userId, tokenHash, error } = await createInviteToken(email);
  if (error || !userId || !tokenHash) {
    throw new ValidationError(error ?? "No se pudo crear la invitación.");
  }
  await repo.upsertProfile({
    id: userId,
    fullName: input.fullName ?? null,
    role: enumForRole(role),
    roleId: role.id,
    // Al aceptar, los guards lo llevan derecho a "Creá tu contraseña".
    mustChangePassword: true,
  });
  invalidateProfileCache(userId);
  const acceptUrl = `${env.NEXT_PUBLIC_SITE_URL}/equipo/aceptar?token_hash=${encodeURIComponent(tokenHash)}&type=invite`;
  try {
    const mail = buildTeamInviteEmail({
      roleName: role.name,
      message: input.message ?? null,
      acceptUrl,
    });
    await sendEmail({ to: email, ...mail });
  } catch (mailError) {
    // Sin correo la invitación no sirve: avisar claro CON el motivo real de
    // Resend (es una pantalla solo-admin; el detalle ayuda a arreglar la
    // config: dominio sin verificar, modo prueba, etc.).
    const detail =
      mailError instanceof Error ? mailError.message : String(mailError);
    throw new ValidationError(
      `La invitación quedó creada pero falló el envío del correo: ${detail}`,
    );
  }
  return { email, promoted: false };
}

/**
 * Reenvía la invitación (link NUEVO de un solo uso; el anterior deja de
 * servir). Vuelve a exigir crear contraseña al entrar.
 */
export async function resendTeamInvite(
  userId: string,
): Promise<{ email: string }> {
  if (!isEmailConfigured()) {
    throw new ValidationError(
      "Falta configurar el envío de correos (RESEND_API_KEY): la invitación no se puede mandar.",
    );
  }
  const email = await getUserEmail(userId);
  if (!email) throw new ValidationError("Usuario no encontrado.");
  const { tokenHash, error } = await createLoginToken(email);
  if (error || !tokenHash) {
    throw new ValidationError(error ?? "No se pudo generar el link.");
  }
  await repo.setMustChangePassword(userId, true);
  invalidateProfileCache(userId);
  const acceptUrl = `${env.NEXT_PUBLIC_SITE_URL}/equipo/aceptar?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
  const mail = buildTeamInviteEmail({
    roleName: null,
    message: null,
    acceptUrl,
  });
  try {
    await sendEmail({ to: email, ...mail });
  } catch (mailError) {
    const detail =
      mailError instanceof Error ? mailError.message : String(mailError);
    throw new ValidationError(`Falló el envío del correo: ${detail}`);
  }
  return { email };
}

/**
 * Asigna un rol a un miembro existente. Deriva el enum de acceso del rol.
 * Salvaguardas: no tu propio rol; no dejar 0 admins.
 */
export async function assignMemberRole(
  actorId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  if (actorId === userId) {
    throw new ValidationError("No podés cambiar tu propio rol.");
  }
  const role = await repo.getRoleById(roleId);
  if (!role) throw new ValidationError("Rol no encontrado.");
  const currentEnum = await repo.getProfileRole(userId);
  if (!currentEnum) throw new ValidationError("Usuario no encontrado.");
  const newEnum = enumForRole(role);
  if (currentEnum === "admin" && newEnum !== "admin") {
    const admins = await repo.countAdmins();
    if (admins <= 1) {
      throw new ValidationError("Debe quedar al menos un administrador.");
    }
  }
  await repo.setProfileRole(userId, newEnum, role.id);
  invalidateProfileCache(userId);
}

/**
 * Regenera la contraseña temporal de un miembro (reenviar acceso). Vuelve a
 * exigir el cambio en el próximo ingreso. Devuelve la nueva contraseña.
 */
export async function resetTeamPassword(
  userId: string,
): Promise<{ password: string; email: string }> {
  const email = await getUserEmail(userId);
  if (!email) throw new ValidationError("Usuario no encontrado.");
  const password = generateTempPassword();
  const { error } = await setUserPassword(userId, password);
  if (error) throw new ValidationError(error);
  await repo.setMustChangePassword(userId, true);
  return { password, email };
}

/**
 * Revoca el acceso al panel: baja el rol a `customer` (no borra la cuenta).
 * Salvaguardas: no podés revocarte a vos mismo ni dejar 0 admins.
 */
export async function removeTeamMember(
  actorId: string,
  targetId: string,
): Promise<void> {
  if (actorId === targetId) {
    throw new ValidationError("No podés quitarte el acceso a vos mismo.");
  }
  const current = await repo.getProfileRole(targetId);
  if (!current) throw new ValidationError("Usuario no encontrado.");
  if (current === "admin") {
    const admins = await repo.countAdmins();
    if (admins <= 1) {
      throw new ValidationError("Debe quedar al menos un administrador.");
    }
  }
  await repo.setProfileRole(targetId, "customer", null);
  invalidateProfileCache(targetId);
}

export type AppearancePatch = {
  businessMode?: BusinessMode;
  accentColor?: string | null;
  season?: string;
  seasonDeco?: boolean;
  seasonIntensity?: number;
  seasonDurationSec?: number;
  homeSections?: Record<string, boolean> | null;
  trustBar?: Array<{ ic: string; t: string; d: string }> | null;
  faq?: Array<{ q: string; a: string }> | null;
  gallery?: Array<{ url: string }> | null;
  bannerIntervalSec?: number;
};

export async function saveAppearance(patch: AppearancePatch): Promise<void> {
  await upsertSettings(patch);
}

/* ---------- Banners ---------- */

export const getActiveBanners = unstable_cache(
  async (): Promise<StoreBanner[]> => {
    return listActiveBanners();
  },
  ["active-banners-public"],
  { revalidate: 60 },
);

export async function getAllBanners(): Promise<StoreBanner[]> {
  return listBanners();
}

export async function createBanner(values: {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  position: string;
  align: string;
  ctaText: string | null;
  ctaHref: string | null;
  isActive: boolean;
  sortOrder: number;
}): Promise<StoreBanner> {
  return insertBanner(values);
}

export async function updateBanner(
  id: string,
  values: Partial<{
    title: string;
    subtitle: string | null;
    imageUrl: string | null;
    position: string;
    align: string;
    ctaText: string | null;
    ctaHref: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
): Promise<StoreBanner> {
  return updateBannerRow(id, values);
}

export async function deleteBanner(id: string): Promise<void> {
  return deleteBannerRow(id);
}
