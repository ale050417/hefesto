import { z } from "zod";
import {
  appearanceSchema,
  bannerSchema,
  businessInfoSchema,
  faqSchema,
  paymentSchema,
  trustBarSchema,
} from "./schemas";
import { SEASONS } from "./seasons";

/**
 * Cuerpos que acepta la API de la app (`/api/v1/admin/configuracion/**`),
 * armados SOBRE los schemas de las Server Actions (schemas.ts) para que la web
 * y la app validen lo mismo. Las diferencias son a propósito:
 *  - PATCH = parcial: solo se tocan los campos que vienen (la web, al guardar,
 *    reescribe todo el formulario).
 *  - Las pantallas del celular guardan por sección, no todo junto.
 */

const EMAIL_RE = /.+@.+\..+/;

/** Datos del negocio (sin los switches de retiro/envío, que van con Envíos). */
export const negocioPatchSchema = businessInfoSchema
  .omit({ pickupEnabled: true, deliveryEnabled: true, facebook: true })
  .extend({
    // La columna `facebook` guarda el TikTok (ver la web).
    tiktok: z.string().trim().max(160).optional().or(z.literal("")),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.storeName !== undefined && v.storeName.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["storeName"],
        message: "Ingresá el nombre del negocio.",
      });
    }
    if (v.contactEmail && !EMAIL_RE.test(v.contactEmail)) {
      ctx.addIssue({
        code: "custom",
        path: ["contactEmail"],
        message: "El email no es válido.",
      });
    }
  });

/** Envíos y retiro: la lista de barrios se reemplaza entera (como en la web). */
export const enviosSchema = z.object({
  city: z.string().trim().max(80),
  freeOver: z.coerce.number().min(0),
  outMsg: z.string().trim().max(500),
  zones: z
    .array(
      z.object({
        name: z.string().trim().max(80),
        price: z.coerce.number().min(0),
      }),
    )
    .max(100),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
});

/** Medios de pago: lo que no viene queda como está. */
export const pagosPatchSchema = paymentSchema;

const SEASON_KEYS = Object.keys(SEASONS) as [string, ...string[]];

/** Apariencia de la tienda + duración de los banners. */
export const tiendaPatchSchema = appearanceSchema
  .extend({
    season: z.enum(SEASON_KEYS).optional(),
    bannerIntervalSec: z.coerce.number().int().min(3).max(12).optional(),
  })
  .partial();

/** Textos clave del home: banda de confianza y/o preguntas frecuentes. */
export const textosPatchSchema = z
  .object({
    trustBar: trustBarSchema.shape.items.optional(),
    faq: faqSchema.shape.items.optional(),
  })
  .refine((v) => v.trustBar !== undefined || v.faq !== undefined, {
    message: "No hay nada para guardar.",
  });

/**
 * Textos por defecto de la cotización por WhatsApp. Mismas reglas que
 * `saveQuoteDefaultsAction` (features/quotes/actions.ts, que no exporta su
 * schema por ser "use server").
 */
export const cotizacionSchema = z.object({
  title: z.string().trim().min(3).max(80),
  depositPct: z.coerce.number().int().min(0).max(100),
  depositText: z.string().trim().max(300),
  notes: z.array(z.string().trim().min(1).max(600)).max(10),
});

/** Edición de un banner existente (la imagen no se cambia desde el celular). */
export const bannerPatchSchema = bannerSchema
  .pick({
    title: true,
    subtitle: true,
    ctaText: true,
    ctaHref: true,
    align: true,
    isActive: true,
  })
  .partial();

export const rolAsignarSchema = z.object({ roleId: z.uuid() });
