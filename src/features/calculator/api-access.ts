import { apiError, requireApiStaff } from "@/core/api/respond";
import { canForUser } from "@/core/auth/permissions";

/**
 * Quién puede usar la calculadora desde la app: quien la ve (calculadora/ver)
 * o quien responde consultas (consultas/editar). La web ya le da la
 * calculadora embebida al que responde una consulta; sin esto, un rol con
 * consultas/editar y sin calculadora/ver no podía sacar el precio desde el
 * celular (2026-11-17).
 */
export async function requireCalcAccess(request: Request) {
  const auth = await requireApiStaff(request);
  if ("response" in auth) return auth;
  const [calc, answers] = await Promise.all([
    canForUser(auth.user, "calculadora", "ver"),
    canForUser(auth.user, "consultas", "editar"),
  ]);
  if (!calc && !answers) {
    return {
      response: apiError("forbidden", "No tenés permiso para hacer esto."),
    };
  }
  return auth;
}
