/**
 * Red de seguridad a nivel aplicación: si una promesa (típicamente una query
 * a la DB) no resuelve dentro de `ms`, la abandonamos y seguimos con un error
 * rápido en vez de dejar la request colgada.
 *
 * Por qué existe: detectamos en producción que una conexión a Postgres puede
 * quedar en estado "ClientRead" (el backend terminó, pero queda esperando al
 * cliente) por varios minutos. `statement_timeout` NO cubre ese caso —
 * solo corta queries que están efectivamente ejecutando. Sin este helper,
 * la página queda "cargando" hasta que Vercel mata la función a los 300s.
 *
 * Nota: esto no cancela la query en Postgres (seguirá corriendo/colgada del
 * lado del server hasta que el pooler o un `pg_terminate_backend` la cierre),
 * pero libera a la request del usuario para que falle rápido en vez de
 * colgarse indefinidamente.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[timeout] ${label} tardó más de ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
