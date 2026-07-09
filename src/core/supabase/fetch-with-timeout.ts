/**
 * `fetch` con timeout (AbortSignal) para los clientes de Supabase.
 *
 * ¿Por qué existe? Un fetch sin timeout puede quedar esperando PARA SIEMPRE un
 * socket muerto (wifi que cambió, notebook que volvió de suspensión, corte).
 * Como el middleware consulta auth en cada request, un solo fetch colgado
 * congelaba TODA la app: botones "cargando" eternos y modales imposibles de
 * cerrar (ver DIAGNOSTICO-CUELGUES-2026-07-09, causa raíz RC1).
 *
 * Con esto la espera queda acotada: al vencer el timeout el fetch aborta con
 * `TimeoutError` y los clientes lo devuelven como un error de red normal
 * (`{ error }`), que la app ya sabe manejar.
 */

/** Timeout por defecto para auth/API (ms). */
export const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Timeout del cliente admin (ms). Más alto porque incluye subidas de imágenes
 * a Storage (hasta 8 MB), que con conexiones lentas tardan más que una API call.
 */
export const SUPABASE_ADMIN_FETCH_TIMEOUT_MS = 60_000;

/** Combina el signal que ya venga en el request (si hay) con uno de timeout. */
function withTimeout(
  existing: AbortSignal | null | undefined,
  ms: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!existing) return timeout;
  // AbortSignal.any: Node 20+, Edge runtime y browsers modernos.
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([existing, timeout]);
  }
  // Runtime viejo sin any(): preferimos respetar el abort externo.
  return existing;
}

/**
 * Crea un `fetch` que aborta a los `ms` milisegundos.
 * `baseFetch` es inyectable para testear sin red; por defecto usa el global
 * (envuelto en arrow para no des-vincular `fetch` del contexto en browsers).
 */
export function fetchWithTimeout(
  ms: number = SUPABASE_FETCH_TIMEOUT_MS,
  baseFetch?: typeof fetch,
): typeof fetch {
  const doFetch: typeof fetch =
    baseFetch ?? ((input, init) => fetch(input, init));
  return (input, init) =>
    doFetch(input, { ...init, signal: withTimeout(init?.signal, ms) });
}
