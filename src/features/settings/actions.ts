"use server";

import { z } from "zod";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { PERM_MODULE_KEYS } from "@/core/auth/perm-defs";
import { type ActionResult, toActionError } from "@/core/errors";
import { optimizeImage, uploadObject } from "@/core/storage";
import {
  createBanner,
  deleteBanner,
  saveAppearance,
  saveBusinessInfo,
  savePaymentSettings,
  saveShippingSettings,
  setBrandImage,
  inviteTeamMember,
  assignMemberRole,
  removeTeamMember,
  resetTeamPassword,
  createRole,
  updateRole,
  deleteRole,
  updateBanner,
} from "./service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function validationError(message: string): ActionResult<{ url: string }> {
  return { ok: false, error: { code: "VALIDATION", message } };
}

export async function uploadBrandImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!(await can("config", "editar"))) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (kind !== "logo" && kind !== "hero") {
    return validationError("Tipo de imagen inválido");
  }
  if (!(file instanceof File)) return validationError("Falta el archivo");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return validationError("Formato no permitido (JPG, PNG o WebP)");
  }
  if (file.size > MAX_BYTES) {
    return validationError("El archivo supera los 8 MB");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const maxSize = kind === "logo" ? 400 : 1600;
    const webp = await optimizeImage(bytes, maxSize);
    const url = await uploadObject(
      "products",
      `brand/${kind}-${Date.now()}.webp`,
      webp,
      "image/webp",
    );
    await setBrandImage(kind, url);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Sube la imagen de un banner del hero y devuelve la URL (no toca el logo/hero
 * de la marca). Mismo pipeline sharp→Storage. Tamaño ideal apaisado (1600px).
 */
export async function uploadBannerImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  if (!(await can("config", "editar"))) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return validationError("Falta el archivo");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return validationError("Formato no permitido (JPG, PNG o WebP)");
  }
  if (file.size > MAX_BYTES) {
    return validationError("El archivo supera los 8 MB");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const webp = await optimizeImage(bytes, 1600);
    const url = await uploadObject(
      "products",
      `banners/banner-${Date.now()}.webp`,
      webp,
      "image/webp",
    );
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const businessInfoSchema = z.object({
  storeName: z.string().trim().max(120).optional().or(z.literal("")),
  slogan: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  contactEmail: z.string().trim().max(160).optional().or(z.literal("")),
  addressText: z.string().trim().max(200).optional().or(z.literal("")),
  instagram: z.string().trim().max(160).optional().or(z.literal("")),
  facebook: z.string().trim().max(160).optional().or(z.literal("")),
  cuit: z.string().trim().max(20).optional().or(z.literal("")),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  hours: z
    .array(
      z.object({
        label: z.string().trim().max(40),
        morning: z.object({
          on: z.boolean(),
          from: z.string().trim().max(10),
          to: z.string().trim().max(10),
        }),
        afternoon: z.object({
          on: z.boolean(),
          from: z.string().trim().max(10),
          to: z.string().trim().max(10),
        }),
      }),
    )
    .optional(),
});

export async function saveBusinessInfoAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const parsed = businessInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  const norm = (v?: string) => (v && v.length > 0 ? v : null);
  try {
    await saveBusinessInfo({
      storeName: norm(parsed.data.storeName),
      slogan: norm(parsed.data.slogan),
      description: norm(parsed.data.description),
      whatsapp: norm(parsed.data.whatsapp),
      contactEmail: norm(parsed.data.contactEmail),
      addressText: norm(parsed.data.addressText),
      instagram: norm(parsed.data.instagram),
      facebook: norm(parsed.data.facebook),
      cuit: norm(parsed.data.cuit),
      pickupEnabled: parsed.data.pickupEnabled ?? true,
      deliveryEnabled: parsed.data.deliveryEnabled ?? true,
      ...(parsed.data.hours ? { hours: parsed.data.hours } : {}),
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// Sin anotar como ActionResult (que incluiría {ok:true}): así su tipo es solo la
// rama de error y es asignable a cualquier ActionResult<T> (banners, etc.).
const UNAUTH = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

const appearanceSchema = z.object({
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional()
    .or(z.literal("")),
  season: z.string().trim().max(40).optional(),
  seasonDeco: z.boolean().optional(),
  seasonIntensity: z.coerce.number().int().min(0).max(100).optional(),
  seasonDurationSec: z.coerce.number().int().min(0).max(120).optional(),
  homeSections: z.record(z.string(), z.boolean()).optional(),
});

export async function saveAppearanceAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá la apariencia." },
    };
  }
  try {
    await saveAppearance({
      accentColor: parsed.data.accentColor ? parsed.data.accentColor : null,
      season: parsed.data.season ?? "none",
      seasonDeco: parsed.data.seasonDeco ?? false,
      seasonIntensity: parsed.data.seasonIntensity ?? 16,
      seasonDurationSec: parsed.data.seasonDurationSec ?? 0,
      ...(parsed.data.homeSections
        ? { homeSections: parsed.data.homeSections }
        : {}),
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// Banda de confianza del home (H25): 4 ítems con ícono fijo + título/texto
// editables. Se guarda en business_settings.trust_bar.
const trustBarSchema = z.object({
  items: z
    .array(
      z.object({
        ic: z.string().trim().max(24),
        t: z.string().trim().max(60),
        d: z.string().trim().max(140),
      }),
    )
    .max(6),
});

export async function saveTrustBarAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = trustBarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá la banda de confianza." },
    };
  }
  try {
    await saveAppearance({ trustBar: parsed.data.items });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// FAQ del home editable: lista de preguntas/respuestas. Vacío = usa las
// preguntas por defecto del home. Se guarda en business_settings.faq.
const faqSchema = z.object({
  items: z
    .array(
      z.object({
        q: z.string().trim().min(1).max(140),
        a: z.string().trim().min(1).max(600),
      }),
    )
    .max(12),
});

export async function saveFaqAction(input: unknown): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá las preguntas frecuentes.",
      },
    };
  }
  try {
    await saveAppearance({ faq: parsed.data.items });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// Duración entre banners (H28): segundos de autoplay del carrusel, acotado a un
// rango razonable (3 a 12 s) para que no quede ni muy rápido ni muy lento.
const bannerIntervalSchema = z.object({
  seconds: z.coerce.number().int().min(3).max(12),
});

export async function saveBannerIntervalAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = bannerIntervalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "La duración debe estar entre 3 y 12 segundos.",
      },
    };
  }
  try {
    await saveAppearance({ bannerIntervalSec: parsed.data.seconds });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const bannerSchema = z.object({
  title: z.string().trim().min(1, "Ingresá un título."),
  subtitle: z.string().trim().max(200).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  position: z.string().trim().max(20).optional().or(z.literal("")),
  align: z.enum(["left", "center", "right"]).optional(),
  ctaText: z.string().trim().max(60).optional().or(z.literal("")),
  ctaHref: z.string().trim().max(200).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const normStr = (v?: string) => (v && v.length > 0 ? v : null);

export async function createBannerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá el banner." },
    };
  }
  try {
    const b = await createBanner({
      title: parsed.data.title,
      subtitle: normStr(parsed.data.subtitle),
      imageUrl: normStr(parsed.data.imageUrl),
      position: parsed.data.position || "50% 50%",
      align: parsed.data.align ?? "left",
      ctaText: normStr(parsed.data.ctaText),
      ctaHref: normStr(parsed.data.ctaHref),
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true, data: { id: b.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateBannerAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá el banner." },
    };
  }
  try {
    await updateBanner(id, {
      title: parsed.data.title,
      subtitle: normStr(parsed.data.subtitle),
      imageUrl: normStr(parsed.data.imageUrl),
      position: parsed.data.position || "50% 50%",
      align: parsed.data.align ?? "left",
      ctaText: normStr(parsed.data.ctaText),
      ctaHref: normStr(parsed.data.ctaHref),
      isActive: parsed.data.isActive ?? true,
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  try {
    await deleteBanner(id);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Métodos de pago ---------- */

const paymentSchema = z.object({
  transferEnabled: z.boolean().optional(),
  transferAlias: z.string().trim().max(120).optional().or(z.literal("")),
  transferCbu: z.string().trim().max(40).optional().or(z.literal("")),
  mpEnabled: z.boolean().optional(),
  mpNote: z.string().trim().max(200).optional().or(z.literal("")),
  cashEnabled: z.boolean().optional(),
  cashNote: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function savePaymentSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const p = paymentSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  const n = (v?: string) => (v && v.length > 0 ? v : null);
  try {
    await savePaymentSettings({
      transferEnabled: p.data.transferEnabled ?? false,
      transferAlias: n(p.data.transferAlias),
      transferCbu: n(p.data.transferCbu),
      mpEnabled: p.data.mpEnabled ?? false,
      mpNote: n(p.data.mpNote),
      cashEnabled: p.data.cashEnabled ?? false,
      cashNote: n(p.data.cashNote),
    });
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Envíos ---------- */

const shippingSchema = z.object({
  city: z.string().trim().max(80).optional().or(z.literal("")),
  freeOver: z.coerce.number().min(0).optional(),
  outMsg: z.string().trim().max(500).optional().or(z.literal("")),
  zones: z
    .array(
      z.object({
        name: z.string().trim().max(80),
        price: z.coerce.number().min(0),
      }),
    )
    .optional(),
});

export async function saveShippingSettingsAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const p = shippingSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá los datos." },
    };
  }
  const n = (v?: string) => (v && v.length > 0 ? v : null);
  try {
    await saveShippingSettings({
      city: n(p.data.city),
      freeOver: p.data.freeOver ?? 0,
      outMsg: n(p.data.outMsg),
      zones: (p.data.zones ?? []).filter((z) => z.name.trim().length > 0),
    });
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Equipo de gestión ---------- */

/** Guard: solo admin puede gestionar el equipo. */
async function requireAdminActor() {
  const actor = await getCurrentUser();
  if (!actor || actor.profile?.role !== "admin") return null;
  return actor;
}

/** Asigna un rol (custom o de sistema) a un miembro existente. */
const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export async function assignMemberRoleAction(
  input: unknown,
): Promise<ActionResult> {
  const actor = await requireAdminActor();
  if (!actor) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede cambiar roles.",
      },
    };
  }
  const p = assignRoleSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos." },
    };
  }
  try {
    await assignMemberRole(actor.id, p.data.userId, p.data.roleId);
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const inviteSchema = z.object({
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email(),
  roleId: z.string().uuid(),
});

type Credentials = { password: string; email: string };

export async function inviteTeamMemberAction(
  input: unknown,
): Promise<ActionResult<Credentials>> {
  const actor = await requireAdminActor();
  if (!actor) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede invitar.",
      },
    };
  }
  const p = inviteSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá nombre, email y rol." },
    };
  }
  try {
    const creds = await inviteTeamMember({
      email: p.data.email,
      roleId: p.data.roleId,
      fullName:
        p.data.fullName && p.data.fullName.length > 0 ? p.data.fullName : null,
    });
    revalidatePath("/admin/configuracion");
    return { ok: true, data: creds };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const resendSchema = z.object({ userId: z.string().uuid() });

export async function resendInviteAction(
  input: unknown,
): Promise<ActionResult<Credentials>> {
  const actor = await requireAdminActor();
  if (!actor) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede regenerar el acceso.",
      },
    };
  }
  const p = resendSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos." },
    };
  }
  try {
    const creds = await resetTeamPassword(p.data.userId);
    revalidatePath("/admin/configuracion");
    return { ok: true, data: creds };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Roles personalizados ---------- */

const PERM_ACTION_KEYS = ["ver", "crear", "editar", "eliminar"] as const;
const MODULE_SET = new Set<string>(PERM_MODULE_KEYS);
const ACTION_SET = new Set<string>(PERM_ACTION_KEYS);

/**
 * Permisos por módulo: acepta cualquier { módulo: acción[] } y lo sanea contra
 * los módulos/acciones CONOCIDOS (PERM_MODULE_KEYS). Queda en sync automático con
 * la matriz: agregar un módulo no requiere tocar este schema. Antes esto era un
 * z.object con 6 claves fijas y descartaba los módulos nuevos (bug: los ticks de
 * Ganancias/A medida/etc. no se guardaban).
 */
const permissionsSchema = z.unknown().transform((raw) => {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === "object") {
    for (const [m, arr] of Object.entries(raw as Record<string, unknown>)) {
      if (!MODULE_SET.has(m) || !Array.isArray(arr)) continue;
      const acts = [
        ...new Set(arr.filter((a): a is string => typeof a === "string")),
      ].filter((a) => ACTION_SET.has(a));
      if (acts.length) out[m] = acts;
    }
  }
  return out;
});

const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(60),
  permissions: permissionsSchema,
});
const updateRoleSchema = createRoleSchema.extend({ id: z.string().uuid() });
const deleteRoleSchema = z.object({ id: z.string().uuid() });

export async function createRoleAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdminActor())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede crear roles.",
      },
    };
  }
  const p = createRoleSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá el nombre y los permisos.",
      },
    };
  }
  try {
    await createRole({ name: p.data.name, permissions: p.data.permissions });
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function updateRoleAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdminActor())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede editar roles.",
      },
    };
  }
  const p = updateRoleSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá el nombre y los permisos.",
      },
    };
  }
  try {
    await updateRole(p.data.id, {
      name: p.data.name,
      permissions: p.data.permissions,
    });
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteRoleAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdminActor())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede borrar roles.",
      },
    };
  }
  const p = deleteRoleSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos." },
    };
  }
  try {
    await deleteRole(p.data.id);
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const removeSchema = z.object({ userId: z.string().uuid() });

export async function removeTeamMemberAction(
  input: unknown,
): Promise<ActionResult> {
  const actor = await requireAdminActor();
  if (!actor) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Solo un administrador puede quitar acceso.",
      },
    };
  }
  const p = removeSchema.safeParse(input);
  if (!p.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Datos inválidos." },
    };
  }
  try {
    await removeTeamMember(actor.id, p.data.userId);
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
