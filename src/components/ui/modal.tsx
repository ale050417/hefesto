"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  // El modal se dibuja al FINAL del body, no donde está escrito en el árbol.
  //
  // Un `position: fixed` deja de referirse a la pantalla si algún ancestro tiene
  // `transform` — y la tarjeta del catálogo lo tiene (se levanta al pasar el
  // mouse). Sin esto, el modal de opciones aparecía metido DENTRO de la
  // tarjeta, de 262px de ancho y recortado por su `overflow: hidden`
  // (2026-08-04). Con el portal, ningún contenedor puede volver a encerrarlo.
  // `document` no existe en el servidor: el portal solo se arma en el cliente.
  const montado = useMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !montado) return null;
  return createPortal(
    // No cierra al hacer click afuera (evita perder lo cargado por accidente).
    // Se cierra con la X o con Escape.
    // `data-portal`: lo saca de la regla `body > *` que pone position:relative
    // (ver globals.css). Sin eso, el modal se dibuja al final de la página.
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-portal=""
    >
      <div className={cn("modal", size === "lg" && "modal-lg")}>
        {title ? (
          <div className="modal-head">
            <h3 className="text-fg font-display text-lg">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-dim hover:text-fg cursor-pointer text-xl leading-none"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
