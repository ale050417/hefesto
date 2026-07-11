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
/**
 * Promise con tope de espera: rechaza con un Error etiquetado si excede `ms`.
 * El `statement_timeout` de la base corta la EJECUCIÓN de una query, pero la
 * espera de conexión en el pool no tiene tope — esto lo pone.
 */
export function withDeadline<T>(
  run: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Si el deadline gana, la query abandonada sigue corriendo y puede rechazar
  // DESPUÉS (p. ej. cuando el statement_timeout de la base la cancela). Ese
  // rechazo tardío no debe quedar sin handler: un unhandledRejection tumba el
  // proceso entero de la función (exit 128) y con Fluid se lleva puestos todos
  // los requests de la instancia (incidente 2026-07-11).
  const guarded = Promise.resolve(run);
  guarded.catch(() => {});
  return Promise.race([
    guarded,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`deadline de "${label}" (>${ms / 1000}s)`)),
        ms,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Variante para páginas que NO pueden renderizar sin el dato (formularios,
 * detalle, configuración): no degrada a un fallback — loguea con etiqueta de
 * sección y relanza para que el error boundary lo muestre. La espera queda
 * acotada (deadline) para no colgar el render hasta el 504 de Vercel.
 */
export async function loadOrThrow<T>(
  label: string,
  run: PromiseLike<T>,
  deadlineMs = 15000,
): Promise<T> {
  try {
    return await withDeadline(run, deadlineMs, label);
  } catch (e) {
    console.error(`[admin:${label}] falló la carga:`, e);
    throw e;
  }
}

export async function safeLoad<T>(
  label: string,
  run: Promise<T>,
  fallback: T,
  // 12 s: con el pool en max 2, las queries de una página se encolan; si la DB
  // está lenta (incidente de capacidad de Supabase 2026-07), 6 s mataba a las
  // que esperaban turno aunque cada una tardara 2-3 s. Con la DB sana todo
  // resuelve en <1 s y este número no juega; el tope duro sigue siendo el
  // maxDuration=30 del layout.
  timeoutMs = 12000,
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
