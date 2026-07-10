"use client";

import { useRef, useState } from "react";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";

type ResultLike = { ok: boolean };

/** Mensaje legible de cualquier variante de fallo del contrato ActionResult. */
function messageOf(result: ResultLike): string {
  const e = (result as { error?: unknown }).error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "No se pudo eliminar. Probá de nuevo.";
}

/**
 * Patrón ÚNICO de eliminación (bug 2026-07-10: borrados sin feedback o con
 * estado inconsistente). Para CUALQUIER sección garantiza:
 *
 *  - await REAL de la Server Action, vía `runAction` (timeout 20 s, overlay,
 *    normalización de errores de red — nunca una promesa colgada);
 *  - SERIALIZACIÓN: una eliminación a la vez. Clics rápidos no encolan ni
 *    pisan estado: el segundo intento avisa y espera a la confirmación;
 *  - feedback SIEMPRE: toast al confirmar el backend; el fallo se LANZA
 *    (dentro de `ConfirmDialog` se muestra inline y el diálogo queda abierto)
 *    o sale por toast en flujos sin diálogo (`notify: "toast"`);
 *  - la lista se actualiza SOLA: la Server Action hace `revalidatePath` y la
 *    vista nueva viaja en la MISMA respuesta del POST (regla del proyecto:
 *    una sola vía de revalidación; acá no va `router.refresh()`);
 *  - `onDeleted` corre recién tras la confirmación (navegar, limpiar
 *    selección, estado local optimista).
 *
 * Uso típico (con diálogo):
 *   const { deleteResource, busyId } = useDeleteResource({
 *     action: deleteCouponAction,
 *     successMessage: "Cupón eliminado",
 *   });
 *   <ConfirmDialog ... onConfirm={() => deleteResource(id)} />
 */
export function useDeleteResource<T = string>(opts: {
  /** Server Action de borrado (DEBE hacer revalidatePath de su vista). */
  action: (target: T) => Promise<ResultLike>;
  successMessage: string;
  /** "throw" (default, para ConfirmDialog) | "toast" (flujos sin diálogo). */
  notify?: "throw" | "toast";
  onDeleted?: (target: T) => void;
}) {
  const [busyId, setBusyId] = useState<T | null>(null);
  const inFlight = useRef(false);

  async function deleteResource(target: T): Promise<boolean> {
    if (inFlight.current) {
      const msg = "Hay una eliminación en curso. Esperá a que termine.";
      if (opts.notify === "toast") {
        toast(msg, "danger");
        return false;
      }
      throw new Error(msg);
    }
    inFlight.current = true;
    setBusyId(target);
    try {
      const res = await runAction(() => opts.action(target), { silent: true });
      if (!res.ok) {
        const message = messageOf(res);
        if (opts.notify === "toast") {
          toast(message, "danger");
          return false;
        }
        throw new Error(message);
      }
      toast(opts.successMessage, "danger");
      opts.onDeleted?.(target);
      return true;
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  }

  return { deleteResource, busyId, deleting: busyId !== null };
}
