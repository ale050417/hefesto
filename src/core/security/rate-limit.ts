import { sql } from "drizzle-orm";

// Rate limiter DISTRIBUIDO sobre Postgres (2026-07, cierra la deuda del
// Cap. 4): un contador por clave con ventana fija, resuelto en UNA sentencia
// atómica (INSERT ... ON CONFLICT) — el límite vale entre todas las instancias
// serverless a la vez, sin dependencias nuevas (usa la misma base que la app).
// La interfaz se mantiene (ahora async). FAIL-OPEN: si el store no responde,
// se permite y se loguea — es una red anti-abuso, no puede voltear el login
// por un hiccup de red (el statement_timeout de 0036 corta la espera).

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimitHit = { count: number; resetAtMs: number };

/**
 * Reducer PURO de la ventana fija — es el contrato que la sentencia SQL
 * replica (los CASE del ON CONFLICT). Testeable sin base (Cap. 15).
 */
export function applyHit(
  prev: RateLimitHit | null,
  nowMs: number,
  windowMs: number,
): RateLimitHit {
  if (!prev || nowMs >= prev.resetAtMs) {
    return { count: 1, resetAtMs: nowMs + windowMs };
  }
  return { count: prev.count + 1, resetAtMs: prev.resetAtMs };
}

/** Mapea el contador al resultado (puro): bloquea cuando count > limit. */
export function toResult(
  hit: RateLimitHit,
  limit: number,
  nowMs: number,
): RateLimitResult {
  const ok = hit.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - hit.count),
    retryAfterMs: ok ? 0 : Math.max(0, hit.resetAtMs - nowMs),
  };
}

export type RateLimitDeps = {
  /** Registra un hit y devuelve el contador vigente (atómico). */
  hit: (key: string, windowMs: number) => Promise<RateLimitHit>;
};

/**
 * Upsert atómico: si la ventana venció reinicia (count=1, nueva ventana); si
 * no, incrementa y conserva el vencimiento. Referenciar la tabla dentro del
 * ON CONFLICT lee la fila EXISTENTE (semántica de Postgres). Imports perezosos
 * para que los tests unitarios no arrastren la conexión.
 */
async function dbHit(key: string, windowMs: number): Promise<RateLimitHit> {
  const { db } = await import("@/core/db");
  const { rateLimits } = await import("@/core/db/schema");
  const secs = windowMs / 1000;
  const [row] = await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      resetAt: sql`now() + ${secs} * interval '1 second'`,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= now() then now() + ${secs} * interval '1 second' else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  if (!row) throw new Error("rate_limits: upsert sin fila");

  // Limpieza oportunista (~1% de los hits): borra claves vencidas hace más de
  // un día. Fire-and-forget: nunca bloquea ni voltea el hit.
  if (Math.random() < 0.01) {
    void db
      .delete(rateLimits)
      .where(sql`${rateLimits.resetAt} < now() - interval '1 day'`)
      .then(undefined, () => undefined);
  }

  return { count: row.count, resetAtMs: row.resetAt.getTime() };
}

const defaultDeps: RateLimitDeps = { hit: dbHit };

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  deps: RateLimitDeps = defaultDeps,
): Promise<RateLimitResult> {
  try {
    const hit = await deps.hit(key, opts.windowMs);
    return toResult(hit, opts.limit, Date.now());
  } catch (error) {
    console.error(
      "[rate-limit] store no disponible; se permite (fail-open):",
      error,
    );
    return { ok: true, remaining: 0, retryAfterMs: 0 };
  }
}
