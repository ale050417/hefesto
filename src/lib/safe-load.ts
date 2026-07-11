/**
 * Carga "resiliente" para páginas del panel (patrón del dashboard, 2026-07).
 *
 * Un `await` a una query que quedó esperando un lock (o un pool sin
 * conexiones libres) cuelga el render entero hasta el timeout de Vercel
 * (30 s → 504 y "el panel no carga"). `safeLoad` acota CADA fuente de datos:
 * si falla o tarda más de `timeoutMs`, la página sigue con el `fallback` y
 * devuelve `ok: false` para que la UI avise que hay datos parciales
 * (ver <DegradedNotice/>): nada de ceros silenciosos.
 */
export async function safeLoad<T>(
  label: string,
  run: Promise<T>,
  fallback: T,
  timeoutMs = 6000,
): Promise<{ value: T; ok: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      run,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`timeout de "${label}" (>${timeoutMs / 1000}s)`)),
          timeoutMs,
        );
      }),
    ]);
    return { value, ok: true };
  } catch (e) {
    console.error(`[safe-load] no se pudo cargar "${label}":`, e);
    return { value: fallback, ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
