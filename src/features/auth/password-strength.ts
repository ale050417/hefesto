/**
 * Fortaleza de contraseña (Fase 8 del plan integral): criterios claros y
 * compartidos entre el medidor en vivo (cliente) y la validación Zod (server).
 * Función pura, sin dependencias.
 */

export type PasswordCheck = {
  id: "length" | "upper" | "lower" | "number" | "symbol";
  label: string;
  ok: boolean;
};

export type PasswordLevel = "vacia" | "debil" | "media" | "fuerte";

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: "Al menos 8 caracteres", ok: password.length >= 8 },
    { id: "upper", label: "Una mayúscula", ok: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { id: "lower", label: "Una minúscula", ok: /[a-záéíóúñ]/.test(password) },
    { id: "number", label: "Un número", ok: /\d/.test(password) },
    {
      id: "symbol",
      label: "Un símbolo (!@#$…)",
      ok: /[^A-Za-z0-9áéíóúñÁÉÍÓÚÑ]/.test(password),
    },
  ];
}

/**
 * Nivel: débil = no alcanza el mínimo aceptado; media = 8+ con mayúscula,
 * minúscula y número; fuerte = además símbolo (o 12+ caracteres).
 */
export function passwordLevel(password: string): PasswordLevel {
  if (password.length === 0) return "vacia";
  const checks = passwordChecks(password);
  const ok = (id: PasswordCheck["id"]) => checks.find((c) => c.id === id)!.ok;
  const base = ok("length") && ok("upper") && ok("lower") && ok("number");
  if (!base) return "debil";
  return ok("symbol") || password.length >= 12 ? "fuerte" : "media";
}

/** ¿Cumple el mínimo aceptado por el servidor? (nivel media o fuerte) */
export function isAcceptablePassword(password: string): boolean {
  const level = passwordLevel(password);
  return level === "media" || level === "fuerte";
}

export const PASSWORD_POLICY_MESSAGE =
  "La contraseña debe tener 8+ caracteres con mayúscula, minúscula y número.";
