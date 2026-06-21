"use client";

import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn("modal", size === "lg" && "modal-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="modal-head">
            <h3 className="text-fg font-display text-lg">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-dim hover:text-fg text-xl leading-none"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
