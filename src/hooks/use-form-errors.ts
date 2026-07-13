"use client";

import { useCallback, useState } from "react";
import { toast } from "@/stores/toastStore";

/**
 * Errores de formulario UNIFORMES (para forms con estado manual). Guarda un mapa
 * { campo: mensaje }, scrollea/enfoca el primer campo inválido y muestra un toast.
 * Nunca falla en silencio.
 *
 * Convención en el JSX:
 *   <div className={cn("field", errors.campo && "invalid")}>
 *     <label ...>...</label>
 *     <input aria-invalid={!!errors.campo} ... />
 *     {errors.campo ? <p className="field-error">{errors.campo}</p> : null}
 *   </div>
 */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clear = useCallback(() => setErrors({}), []);

  const focusFirst = useCallback(() => {
    if (typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        '[aria-invalid="true"], .field.invalid',
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus?.();
    });
  }, []);

  /**
   * Valida un mapa { campo: mensaje | null }. Marca los que tengan mensaje, avisa
   * con toast y scrollea al primero. Devuelve true si está todo OK.
   */
  const check = useCallback(
    (fields: Record<string, string | null | undefined | false>): boolean => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) if (v) next[k] = v;
      setErrors(next);
      if (Object.keys(next).length > 0) {
        // Sin toast genérico: cada campo se marca en rojo con su mensaje debajo.
        focusFirst();
        return false;
      }
      return true;
    },
    [focusFirst],
  );

  /** Mapea los field errors de un ActionResult ({ code: 'VALIDATION', fields }). */
  const fromAction = useCallback(
    (err: { message?: string; fields?: Record<string, string> }): void => {
      if (err.fields && Object.keys(err.fields).length > 0) {
        // Con detalle por campo: rojo + mensaje debajo, sin toast genérico.
        setErrors(err.fields);
        focusFirst();
      } else if (err.message) {
        // Sin detalle por campo: recién ahí mostramos el mensaje en un toast.
        toast(err.message, "danger");
      }
    },
    [focusFirst],
  );

  return { errors, setErrors, clear, check, fromAction };
}
