"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Reencuadre por ARRASTRE. Devuelve handlers para un contenedor con la imagen en
 * "cover" (object-position o background-position): al arrastrar, mueve el foco.
 * Anda con mouse y touch (Pointer Events + setPointerCapture). `onChange` recibe
 * X/Y en % (0–100). Arrastrar la imagen a la derecha/abajo baja el % (revela la
 * izquierda/arriba), como reposicionar una foto de portada.
 */
export function useDragReframe(
  posX: number,
  posY: number,
  onChange: (x: number, y: number) => void,
) {
  const start = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    start.current = { x: e.clientX, y: e.clientY, px: posX, py: posY };
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((e.clientX - s.x) / rect.width) * 100;
    const dy = ((e.clientY - s.y) / rect.height) * 100;
    onChange(clamp(s.px - dx), clamp(s.py - dy));
  }
  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    start.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
