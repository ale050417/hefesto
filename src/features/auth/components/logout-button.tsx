"use client";

import type { ReactNode } from "react";
import { logoutAction } from "../actions";
import { limpiarEstadoLocal } from "./session-guard";

/**
 * Botón de "Cerrar sesión". Borra el carrito, los favoritos y las señales del
 * checkout ANTES de mandar el formulario.
 *
 * Se limpia acá y no solo en el guardián del layout para que no dependa de
 * cachés ni de que el layout vuelva a renderizarse: al soltar el botón, en esta
 * computadora ya no queda nada del cliente. El guardián sigue existiendo como
 * red de seguridad (sesión vencida, otra pestaña, otra persona que entra).
 */
export function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={logoutAction} onSubmit={() => limpiarEstadoLocal()}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
