"use server";

import { z } from "zod";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { optimizeImage, uploadObject } from "@/core/storage";
import {
  createBanner,
  deleteBanner,
  saveAppearance,
  saveBusinessInfo,
  savePaymentSettings,
  saveMpAccessToken,
  saveShippingSettings,
  setBrandImage,
  assignMemberRole,
  removeTeamMember,
  createRole,
  updateRole,
  deleteRole,
  updateBanner,
} from "./service";
import {
  appearanceSchema,
  assignRoleSchema,
  bannerIntervalSchema,
  bannerSchema,
  businessInfoSchema,
  createRoleSchema,
  deleteRoleSchema,
  faqSchema,
  inviteSchema,
  mpTokenSchema,
  paymentSchema,
  removeSchema,
  resendSchema,
  shippingSchema,
  trustBarSchema,
  updateRoleSchema,
} from "./schemas";
import { inviteMemberAudited, resendInviteAudited } from "./team-flow";

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

/** Sube una foto para la galería curada del home y devuelve su URL (sin tabla:
 *  la lista de URLs se guarda en business_settings.gallery). */
export async function uploadGalleryImageAction(
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
    const webp = await optimizeImage(bytes, 1200);
    const url = await uploadObject(
      "products",
      `gallery/foto-${Date.now()}.webp`,
      webp,
      "image/webp",
    );
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// Galería curada del home: lista de fotos (URLs). Se guarda en
// business_settings.gallery. Vacío = no se muestra la sección.
const gallerySchema = z.object({
  items: z.array(z.object({ url: z.string().trim().url().max(2048) })).max(12),
});

export async function saveGalleryAction(input: unknown): Promise<ActionResult> {
  if (!(await can("config", "editar"))) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "No autorizado" },
    };
  }
  const parsed = gallerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Revisá la galería." },
    };
  }
  try {
    await saveAppearance({ gallery: parsed.data.items });
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

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
      ...(parsed.data.businessMode
        ? { businessMode: parsed.data.businessMode }
        : {}),
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

export async function saveMpTokenAction(input: unknown): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  const parsed = mpTokenSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "El token no parece válido (muy corto).",
      },
    };
  }
  try {
    await saveMpAccessToken(parsed.data.token);
    revalidatePath("/admin/configuracion");
    revalidatePath("/checkout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function disconnectMpAction(): Promise<ActionResult> {
  if (!(await can("config", "editar"))) return UNAUTH;
  try {
    await saveMpAccessToken(null);
    revalidatePath("/admin/configuracion");
    revalidatePath("/checkout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Envíos ---------- */

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

export async function inviteTeamMemberAction(
  input: unknown,
): Promise<ActionResult<{ email: string; promoted: boolean }>> {
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
    // Invitación + auditoría + revalidación: compartido con la API de la app.
    const result = await inviteMemberAudited(actor.id, p.data);
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function resendInviteAction(
  input: unknown,
): Promise<ActionResult<{ email: string }>> {
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
    const result = await resendInviteAudited(actor.id, p.data.userId);
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/* ---------- Roles personalizados ---------- */

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

/* ---------- Banners con IA (2026-10-21) ---------- */

/**
 * Renueva los banners del hero con IA ahora mismo (botón de Config → Tienda).
 * Mismo trabajo que el cron, sin esperar los 10 días.
 */
export async function refreshAutoBannersAction(): Promise<
  ActionResult<{ created: number }>
> {
  if (!(await can("config", "editar"))) return UNAUTH;
  try {
    const { refreshAutoBanners } = await import("./auto-banners");
    const result = await refreshAutoBanners({ force: true });
    if (!result.ok) {
      const message =
        result.skipped === "not_configured"
          ? "Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel."
          : result.skipped === "no_products"
            ? "No hay productos publicados con foto para armar banners."
            : "La IA no devolvió banners válidos. Probá de nuevo.";
      return { ok: false, error: { code: "VALIDATION", message } };
    }
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true, data: { created: result.created } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
