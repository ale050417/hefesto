import { z } from "zod";
import { PERM_MODULE_KEYS } from "@/core/auth/perm-defs";

/**
 * Schemas de entrada de Configuración, COMPARTIDOS entre las Server Actions de
 * la web (`actions.ts`) y la API de la app móvil
 * (`/api/v1/admin/configuracion/**`, 2026-10-31). Una sola definición para que
 * las dos puertas validen exactamente lo mismo.
 *
 * (Un archivo "use server" solo puede exportar funciones async, por eso viven
 * acá y no en `actions.ts`.)
 */

/* ---------- Negocio ---------- */

export const businessInfoSchema = z.object({
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

/* ---------- Apariencia / textos del home ---------- */

export const appearanceSchema = z.object({
  businessMode: z.enum(["checkout", "vidriera"]).optional(),
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

// Banda de confianza del home (H25): 4 ítems con ícono fijo + título/texto
// editables. Se guarda en business_settings.trust_bar.
export const trustBarSchema = z.object({
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

// FAQ del home editable: lista de preguntas/respuestas. Vacío = usa las
// preguntas por defecto del home. Se guarda en business_settings.faq.
export const faqSchema = z.object({
  items: z
    .array(
      z.object({
        q: z.string().trim().min(1).max(140),
        a: z.string().trim().min(1).max(600),
      }),
    )
    .max(12),
});

// Duración entre banners (H28): segundos de autoplay del carrusel, acotado a un
// rango razonable (3 a 12 s) para que no quede ni muy rápido ni muy lento.
export const bannerIntervalSchema = z.object({
  seconds: z.coerce.number().int().min(3).max(12),
});

export const bannerSchema = z.object({
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

/* ---------- Pagos y envíos ---------- */

export const paymentSchema = z.object({
  transferEnabled: z.boolean().optional(),
  transferAlias: z.string().trim().max(120).optional().or(z.literal("")),
  transferCbu: z.string().trim().max(40).optional().or(z.literal("")),
  mpEnabled: z.boolean().optional(),
  mpNote: z.string().trim().max(200).optional().or(z.literal("")),
  cashEnabled: z.boolean().optional(),
  cashNote: z.string().trim().max(200).optional().or(z.literal("")),
});

// MercadoPago conectable: el vendedor pega/borra su Access Token (server-only,
// nunca vuelve al cliente).
export const mpTokenSchema = z.object({
  token: z.string().trim().min(10).max(500),
});

export const shippingSchema = z.object({
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

/* ---------- Equipo ---------- */

/** Asigna un rol (custom o de sistema) a un miembro existente. */
export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const inviteSchema = z.object({
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email(),
  roleId: z.string().uuid(),
  /** Mensaje personal del admin: viaja en el correo de invitación. */
  message: z.string().trim().max(600).optional().or(z.literal("")),
});

export const resendSchema = z.object({ userId: z.string().uuid() });

export const removeSchema = z.object({ userId: z.string().uuid() });

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
export const permissionsSchema = z.unknown().transform((raw) => {
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

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(60),
  permissions: permissionsSchema,
});
export const updateRoleSchema = createRoleSchema.extend({
  id: z.string().uuid(),
});
export const deleteRoleSchema = z.object({ id: z.string().uuid() });
