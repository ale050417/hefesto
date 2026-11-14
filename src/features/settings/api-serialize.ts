import { PERM_MODULES } from "@/core/auth/perm-defs";
import {
  DEFAULT_QUOTE_DEFAULTS,
  type QuoteDefaults,
} from "@/features/quotes/build-quote";
import { DEFAULT_FAQ } from "./faq-defaults";
import { HOME_SECTIONS, sectionOn } from "./home-sections";
import { SEASONS, type SeasonKey } from "./seasons";
import { DEFAULT_TRUST_BAR } from "./trust-defaults";
import type {
  BusinessSettings,
  PaymentSettings,
  Role,
  ShippingSettings,
  StoreBanner,
  TeamMember,
} from "./types";

/**
 * Armado del JSON de Configuración para la app móvil (2026-10-31). Funciones
 * PURAS (sin base ni sesión): reciben las filas ya leídas y devuelven lo que
 * viaja por `/api/v1/admin/configuracion`. Así se testean sin mocks.
 *
 * SEGURIDAD: el Access Token de MercadoPago NUNCA sale de acá — solo
 * `mpConnected` (igual que la página web).
 */

export type HourShift = { on: boolean; from: string; to: string };
export type HourRow = {
  label: string;
  morning: HourShift;
  afternoon: HourShift;
};

const OFF: HourShift = { on: false, from: "", to: "" };

export const DEFAULT_HOURS: HourRow[] = [
  {
    label: "Lun a Vie",
    morning: { on: true, from: "09:00", to: "13:00" },
    afternoon: { on: true, from: "16:00", to: "20:00" },
  },
  {
    label: "Sábados",
    morning: { on: true, from: "09:00", to: "13:00" },
    afternoon: { ...OFF },
  },
  { label: "Domingos", morning: { ...OFF }, afternoon: { ...OFF } },
];

/**
 * Acepta el formato nuevo (mañana/tarde) o el viejo (`{from,to,on}`) y devuelve
 * siempre el nuevo: el rango viejo pasa al turno "mañana". Mismo criterio que
 * el formulario web (business-config-form.tsx).
 */
export function normalizeHours(raw: unknown): HourRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HOURS.map((h) => ({
      label: h.label,
      morning: { ...h.morning },
      afternoon: { ...h.afternoon },
    }));
  }
  const toShift = (s: unknown): HourShift => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      on: Boolean(o.on),
      from: String(o.from ?? ""),
      to: String(o.to ?? ""),
    };
  };
  return raw.map((r) => {
    const h = (r ?? {}) as Record<string, unknown>;
    const label = String(h.label ?? "");
    if (h.morning || h.afternoon) {
      return {
        label,
        morning: toShift(h.morning),
        afternoon: toShift(h.afternoon),
      };
    }
    return { label, morning: toShift(h), afternoon: { ...OFF } };
  });
}

const str = (v: string | null | undefined) => v ?? "";

export function serializeNegocio(s: BusinessSettings | null) {
  return {
    storeName: str(s?.storeName),
    slogan: str(s?.slogan),
    description: str(s?.description),
    whatsapp: str(s?.whatsapp),
    contactEmail: str(s?.contactEmail),
    addressText: str(s?.addressText),
    instagram: str(s?.instagram),
    // La columna `facebook` guarda el TikTok (sin migración; ver la web).
    tiktok: str(s?.facebook),
    cuit: str(s?.cuit),
    hours: normalizeHours(s?.hours),
  };
}

export function serializeEnvios(
  shipping: ShippingSettings | null,
  s: BusinessSettings | null,
) {
  return {
    city: str(shipping?.city),
    freeOver: Number(shipping?.freeOver ?? 0) || 0,
    outMsg: str(shipping?.outMsg),
    zones: (shipping?.zones ?? []).map((z) => ({
      name: String(z.name ?? ""),
      price: Number(z.price) || 0,
    })),
    pickupEnabled: s?.pickupEnabled ?? true,
    deliveryEnabled: s?.deliveryEnabled ?? true,
  };
}

export function serializePagos(p: PaymentSettings | null) {
  return {
    transferEnabled: p?.transferEnabled ?? true,
    transferAlias: str(p?.transferAlias),
    transferCbu: str(p?.transferCbu),
    mpEnabled: p?.mpEnabled ?? true,
    mpNote: str(p?.mpNote),
    // El token queda en el servidor: solo se informa si está conectado.
    mpConnected: Boolean(p?.mpAccessToken?.trim()),
    cashEnabled: p?.cashEnabled ?? true,
    cashNote: str(p?.cashNote),
  };
}

export function serializeBanner(b: StoreBanner) {
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    position: b.position,
    align: b.align,
    ctaText: b.ctaText,
    ctaHref: b.ctaHref,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
  };
}

export function serializeTienda(
  s: BusinessSettings | null,
  banners: StoreBanner[],
) {
  const season: string = s?.season && s.season in SEASONS ? s.season : "none";
  return {
    businessMode: s?.businessMode === "vidriera" ? "vidriera" : "checkout",
    accentColor: s?.accentColor ?? null,
    season,
    seasonDeco: s?.seasonDeco ?? false,
    seasonIntensity: s?.seasonIntensity ?? 16,
    seasonDurationSec: s?.seasonDurationSec ?? 0,
    bannerIntervalSec: s?.bannerIntervalSec ?? 5,
    logoUrl: s?.logoUrl ?? null,
    heroImageUrl: s?.heroImageUrl ?? null,
    homeSections: HOME_SECTIONS.map((h) => ({
      id: h.id,
      label: h.label,
      on: sectionOn(s?.homeSections, h.id),
    })),
    seasons: (Object.keys(SEASONS) as SeasonKey[]).map((key) => ({
      key,
      label: SEASONS[key].label,
      hint: SEASONS[key].hint,
      accent: SEASONS[key].accent,
      hasDeco: SEASONS[key].deco !== null,
    })),
    banners: banners.map(serializeBanner),
  };
}

export function serializeTextos(
  s: BusinessSettings | null,
  quote: QuoteDefaults,
) {
  const trust = s?.trustBar;
  const faq = s?.faq;
  const trustCustom = Array.isArray(trust) && trust.length > 0;
  const faqCustom = Array.isArray(faq) && faq.length > 0;
  return {
    // Lo que muestra la tienda hoy: lo guardado o, si nunca se editó, el default.
    trustBar: trustCustom ? trust : DEFAULT_TRUST_BAR,
    trustBarCustom: trustCustom,
    faq: faqCustom ? faq : DEFAULT_FAQ,
    faqCustom,
    quote: {
      title: quote.title,
      depositPct: quote.depositPct,
      depositText: quote.depositText,
      notes: quote.notes,
    },
  };
}

export function buildConfigSnapshot(input: {
  settings: BusinessSettings | null;
  payment: PaymentSettings | null;
  shipping: ShippingSettings | null;
  banners: StoreBanner[];
  quote: QuoteDefaults | null;
}) {
  return {
    negocio: serializeNegocio(input.settings),
    envios: serializeEnvios(input.shipping, input.settings),
    pagos: serializePagos(input.payment),
    tienda: serializeTienda(input.settings, input.banners),
    textos: serializeTextos(
      input.settings,
      input.quote ?? DEFAULT_QUOTE_DEFAULTS,
    ),
  };
}

/** Equipo + roles + matriz de módulos para la pantalla de usuarios. */
export function buildTeamSnapshot(input: {
  team: TeamMember[];
  roles: Role[];
  currentUserId: string;
  canManage: boolean;
}) {
  const { team, roles, currentUserId, canManage } = input;
  const adminCount = team.filter((t) => t.role === "admin").length;
  return {
    canManage,
    team: team.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      email: t.email,
      role: t.role,
      roleId: t.roleId,
      roleName: t.roleName,
      status: t.status,
      isSelf: t.id === currentUserId,
      // El último administrador no se puede degradar ni quitar (lo valida el
      // servicio; esto es para que la app no ofrezca el botón).
      isLastAdmin: t.role === "admin" && adminCount <= 1,
    })),
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      isAdmin: r.isAdmin,
      permissions: r.permissions ?? {},
      memberCount: team.filter((t) => t.roleId === r.id).length,
    })),
    modules: PERM_MODULES.map(([key, label]) => ({ key, label })),
  };
}
