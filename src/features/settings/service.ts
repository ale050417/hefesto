import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  createUserWithPassword,
  getUserEmail,
  listAuthUsers,
  setUserPassword,
} from "@/core/supabase/admin";
import { env } from "@/core/config/env";
import { sendEmail } from "@/core/email";
import { DEFAULT_OPERATOR } from "@/core/auth/perm-defs";
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
    const s = await getSettings();
    return {
      logoUrl: s?.logoUrl ?? null,
      heroImageUrl: s?.heroImageUrl ?? null,
      storeName: s?.storeName ?? null,
      slogan: s?.slogan ?? null,
      whatsapp: s?.whatsapp ?? null,
      instagram: s?.instagram ?? null,
      facebook: s?.facebook ?? null,
      contactEmail: s?.contactEmail ?? null,
      accentColor: s?.accentColor ?? null,
      season: s?.season ?? "none",
      seasonDeco: s?.seasonDeco ?? false,
      seasonIntensity: s?.seasonIntensity ?? 16,
      seasonDurationSec: s?.seasonDurationSec ?? 0,
      homeSections: s?.homeSections ?? null,
      trustBar: s?.trustBar ?? null,
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
    const pending = !!a?.invitedAt && !a?.lastSignInAt;
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

/** Aviso por email (sin contraseña: la comparte el admin por canal seguro). */
async function notifyAccessGranted(email: string, roleLabel: string) {
  try {
    await sendEmail({
      to: email,
      subject: "Tenés acceso al panel de Hefesto 3D",
      html: `<p>Hola,</p><p>Te dieron acceso al panel de gestión de <b>Hefesto 3D</b> como <b>${roleLabel}</b>.</p><p>Ingresá en <a href="${env.NEXT_PUBLIC_SITE_URL}/ingresar">${env.NEXT_PUBLIC_SITE_URL}/ingresar</a> con tu email. La persona que te invitó te pasará una contraseña temporal que deberás cambiar en tu primer ingreso.</p>`,
    });
  } catch (error) {
    console.error("[email] no se pudo avisar el acceso:", error);
  }
}

/** El enum de acceso se deriva del rol: admin si es el rol full, si no operador. */
function enumForRole(role: Role): StaffRole {
  return role.isAdmin ? "admin" : "operator";
}

/**
 * Crea el acceso de un miembro con una CONTRASEÑA TEMPORAL (Supabase createUser,
 * email ya confirmado) y le asigna el rol elegido. Devuelve la contraseña para
 * mostrarla en el panel; el miembro deberá cambiarla en su primer ingreso.
 * La autorización (admin) va en la action.
 */
export async function inviteTeamMember(input: {
  email: string;
  roleId: string;
  fullName?: string | null;
}): Promise<{ password: string; email: string }> {
  const role = await repo.getRoleById(input.roleId);
  if (!role) throw new ValidationError("Elegí un rol válido.");
  const password = generateTempPassword();
  const { id, error } = await createUserWithPassword(input.email, password);
  if (error || !id) {
    const dup =
      error?.toLowerCase().includes("already") ||
      error?.toLowerCase().includes("registered");
    throw new ValidationError(
      dup
        ? "Ese email ya tiene una cuenta."
        : (error ?? "No se pudo crear el acceso."),
    );
  }
  await repo.upsertProfile({
    id,
    fullName: input.fullName ?? null,
    role: enumForRole(role),
    roleId: role.id,
    mustChangePassword: true,
  });
  await notifyAccessGranted(input.email, role.name);
  return { password, email: input.email };
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
}

export type AppearancePatch = {
  accentColor?: string | null;
  season?: string;
  seasonDeco?: boolean;
  seasonIntensity?: number;
  seasonDurationSec?: number;
  homeSections?: Record<string, boolean> | null;
  trustBar?: Array<{ ic: string; t: string; d: string }> | null;
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
