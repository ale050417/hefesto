/**
 * Punto único de observabilidad (Cap. 17). Hoy es un wrapper liviano sobre
 * console; cuando se configure Sentry en el deploy, se cablea acá UNA sola vez
 * sin tocar los call sites. No agregamos el SDK todavía para no sumar una
 * dependencia que aún no se usa (Cap. 4).
 *
 * Seguro de importar desde cliente y servidor: lee solo variables NEXT_PUBLIC_*
 * y no depende de core/config/env (que es server-only).
 */
type Context = Record<string, unknown>;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";

/** Registra una excepción. Best-effort: nunca relanza. */
export function captureException(error: unknown, context?: Context): void {
  try {
    if (context) console.error("[observability]", error, context);
    else console.error("[observability]", error);
    // TODO(deploy): si hay DSN, reenviar a Sentry.captureException.
    void dsn;
  } catch {
    // Nunca rompemos la app por telemetría.
  }
}

/** Mensaje informativo notable (condición esperada pero digna de registro). */
export function captureMessage(message: string, context?: Context): void {
  try {
    if (context) console.warn("[observability]", message, context);
    else console.warn("[observability]", message);
  } catch {
    // noop
  }
}

/** True si la observabilidad remota está configurada (hay DSN). */
export function isObservabilityEnabled(): boolean {
  return dsn.length > 0;
}
