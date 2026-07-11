import { z } from "zod";

const uuidSchema = z.string().uuid();

/**
 * ¿Tiene forma de UUID? Para validar params de rutas dinámicas ([id]) ANTES
 * de tocar la base: un id inválido (p. ej. /admin/pedidos/loquesea) debe ser
 * un 404, no un `invalid input syntax for type uuid` de Postgres que tira el
 * error boundary del panel entero (bug 2026-07-11).
 */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
