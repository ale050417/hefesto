/**
 * Instrumentation de Next (corre UNA vez por instancia del server).
 *
 * Guardián de unhandledRejection: sin handler registrado, Node mata el
 * proceso entero ante un rechazo sin atrapar (exit 128). En Vercel con Fluid
 * Compute una instancia atiende varios requests a la vez, así que UNA query
 * cancelada por el statement_timeout de la base (rechazo tardío de una
 * promesa abandonada) tumbaba TODOS los requests en vuelo — el efecto dominó
 * del incidente 2026-07-11. Con el handler, queda logueado y la instancia
 * sigue viva.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error(
        "[unhandled-rejection] atrapado (la instancia sigue viva):",
        reason,
      );
    });
  }
}
