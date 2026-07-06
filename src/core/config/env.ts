import { z } from "zod";

/**
 * Validación de variables de entorno (Libro Maestro, Cap. 14).
 *
 * Importar SOLO desde el servidor. Si falta o está mal una variable,
 * la app falla al arrancar con un mensaje claro, en vez de romperse
 * silenciosamente más tarde.
 *
 * SKIP_ENV_VALIDATION=1 desactiva la validación (se usa en el build de CI,
 * donde no hay secretos). En runtime la validación SIEMPRE corre.
 */
const envSchema = z.object({
  // --- Públicas (Next las expone al navegador por el prefijo NEXT_PUBLIC) ---
  // URL pública del sitio (back_urls de MercadoPago, sitemap, emails).
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Publishable key de Supabase (sistema nuevo de claves; antes "anon").
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Teléfono de WhatsApp (FAB de contacto / links wa.me). Opcional: sin él, el
  // botón de WhatsApp simplemente no se muestra (ver lib/site.ts).
  NEXT_PUBLIC_WHATSAPP_PHONE: z.string().optional(),

  // --- Secretas (solo servidor, NUNCA al navegador) ---
  // Secret key de Supabase (sistema nuevo; antes "service_role").
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Connection string de Postgres (Supabase) para Drizzle.
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\//,
      "Debe empezar con postgres:// o postgresql://",
    ),
  // Access token de MercadoPago (servidor). Opcional: si no está, el pago con
  // MP falla con un mensaje claro, pero la app arranca igual.
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  // Secret para verificar la firma del webhook de MercadoPago.
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  // Resend (emails transaccionales). Opcionales: sin API key, el email se omite.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  // Observabilidad (Cap. 17). Opcionales: sin DSN, captureException solo loguea.
  // El SDK de Sentry se cablea en el deploy (no agregamos la dependencia acá).
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  // Analytics (ej. Vercel Analytics / Plausible). Opcional.
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

const skip =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

function loadEnv(): Env {
  if (skip) {
    return process.env as unknown as Env;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Variables de entorno inválidas. Revisá tu .env.local:\n${detalle}`,
    );
  }
  // NEXT_PUBLIC_SITE_URL tiene default localhost para no romper dev, pero en
  // producción olvidarla rompe silenciosamente las back_urls de MercadoPago,
  // el sitemap y los links de los emails. Avisamos fuerte (checklist Fase 11).
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.NEXT_PUBLIC_SITE_URL
  ) {
    console.error(
      "[env] NEXT_PUBLIC_SITE_URL no está configurada: MercadoPago, sitemap y " +
        "emails van a apuntar a localhost. Configurala en Vercel.",
    );
  }
  return parsed.data;
}

export const env = loadEnv();
