/**
 * Selección del Access Token de MercadoPago (DINERO) — función PURA, sin DB ni
 * red, para poder testearla sola. Prioridad: el token que el vendedor pegó en
 * el panel (DB); si no hay, el de la variable de entorno.
 */
export function pickMpAccessToken(
  dbToken: string | null | undefined,
  envToken: string | null | undefined,
): string | null {
  const fromDb = dbToken?.trim();
  if (fromDb) return fromDb;
  const fromEnv = envToken?.trim();
  return fromEnv ? fromEnv : null;
}
