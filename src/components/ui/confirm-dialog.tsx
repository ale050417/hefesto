"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

/**
 * Diálogo de confirmación para acciones destructivas (borrar). Patrón único de
 * toda la app: ícono danger, título "¿Eliminar X?", texto "no se puede deshacer"
 * y botones Cancelar / Eliminar. Reemplaza al `confirm()` nativo.
 *
 * La acción real la pasa el que lo usa en `onConfirm`: si esa promesa lanza, el
 * mensaje se muestra inline y el diálogo NO se cierra; si resuelve, se cierra.
 * Así el llamador se ocupa del toast/refresh y el diálogo del loading/error.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description = "Esta acción no se puede deshacer.",
  detail,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
}: {
  open: boolean;
  onClose: () => void;
  /** Corre la acción. Si lanza, se muestra el error y el diálogo queda abierto. */
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  /** Línea principal. Por defecto la advertencia estándar. */
  description?: ReactNode;
  /** Aviso extra (ej. "se devolverán 120 g de PLA Negro al stock"). */
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        onClose();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo completar la acción.",
        );
      }
    });
  }

  function handleClose() {
    if (isPending) return; // no cerrar mientras borra
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={isPending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className="bg-danger/10 text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>
        <div className="space-y-2 pt-1">
          <p className="text-dim text-sm">{description}</p>
          {detail ? <p className="text-faint text-xs">{detail}</p> : null}
          {error ? (
            <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
