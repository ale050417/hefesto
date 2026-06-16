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
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Publishable key de Supabase (sistema nuevo de claves; antes "anon").
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

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
  return parsed.data;
}

export const env = loadEnv();
