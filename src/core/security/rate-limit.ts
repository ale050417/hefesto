// Rate limiter simple en memoria (por proceso). Suficiente para una sola
// instancia; para multi-instancia se reemplaza por un store compartido (Redis/
// Upstash) detrás de esta misma interfaz. Función pura (now inyectable) → testeable.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }
  if (bucket.count >= opts.limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return {
    ok: true,
    remaining: opts.limit - bucket.count,
    retryAfterMs: bucket.resetAt - now,
  };
}

/** Solo para tests: limpia el estado interno. */
export function __resetRateLimit(): void {
  buckets.clear();
}
