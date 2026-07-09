import type { ActionResult } from "@/core/errors";
import { useActionOverlayStore } from "@/stores/actionOverlayStore";
import { toast } from "@/stores/toastStore";

/** Forma de falla del contrato canónico (core/errors → ActionResult). */
export type ActionFailure = Extract<ActionResult, { ok: false }>;

/** Tiempo máximo que una acción puede tener a la UI esperando. */
export const ACTION_TIMEOUT_MS = 20_000;

const TIMEOUT_MESSAGE =
  "La operación tardó demasiado. Puede haberse aplicado igual: revisá el listado antes de reintentar.";
const NETWORK_MESSAGE =
  "Error de conexión. Verificá tu red y volvé a intentar.";

/** Extrae un mensaje legible de cualquier variante de resultado fallido. */
function failureMessage(result: { ok: boolean }): string {
  const e = (result as { error?: unknown }).error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "No se pudo completar la acción.";
}

/**
 * Corre una Server Action desde el cliente con la UX y las garantías estándar
 * (DIAGNOSTICO-CUELGUES-2026-07-09, RC2):
 *
 *  - Muestra el overlay bloqueante de la "H" mientras dura (y SIEMPRE lo
 *    libera: `finally`). `overlay: false` para micro-acciones (chat, favorito).
 *  - Timeout de 20 s: la UI nunca queda esperando para siempre.
 *  - Errores de red / promesas rechazadas → `{ok:false}` canónico (nunca
 *    lanza), con toast automático salvo `silent: true` (forms con error inline).
 *
 * Genérico sobre el shape del resultado: acepta cualquier `{ ok: boolean, … }`
 * y lo devuelve tal cual; solo las fallas sintetizadas (timeout/red) usan el
 * contrato canónico de core/errors.
 */
export async function runAction<R extends { ok: boolean }>(
  fn: () => Promise<R>,
  opts?: {
    label?: string;
    timeoutMs?: number;
    silent?: boolean;
    /** `false` = sin overlay bloqueante (conserva timeout y normalización). */
    overlay?: boolean;
  },
): Promise<R | ActionFailure> {
  const { begin, end } = useActionOverlayStore.getState();
  const showOverlay = opts?.overlay !== false;
  const timeoutMs = opts?.timeoutMs ?? ACTION_TIMEOUT_MS;
  if (showOverlay) begin(opts?.label);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ActionTimeoutError()), timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeout]);
    if (!result.ok && !opts?.silent) toast(failureMessage(result), "danger");
    return result;
  } catch (e) {
    const isTimeout = e instanceof ActionTimeoutError;
    const message = isTimeout ? TIMEOUT_MESSAGE : NETWORK_MESSAGE;
    if (!opts?.silent) toast(message, "danger");
    return {
      ok: false,
      error: { code: isTimeout ? "TIMEOUT" : "NETWORK", message },
    };
  } finally {
    clearTimeout(timer);
    if (showOverlay) end();
  }
}

class ActionTimeoutError extends Error {
  constructor() {
    super("action timeout");
    this.name = "ActionTimeoutError";
  }
}
