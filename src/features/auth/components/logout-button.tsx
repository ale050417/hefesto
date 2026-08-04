"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";
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
      <Boton className={className}>{children}</Boton>
    </form>
  );
}

/**
 * El estado "Cerrando sesión…" tiene que vivir DENTRO del form: `useFormStatus`
 * solo ve el envío del formulario que lo contiene. Cerrar sesión implica un ida
 * y vuelta al servidor y sin aviso parecía que el botón no había hecho nada.
 */
function Boton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (
        <>
          <Spinner size={15} />
          Cerrando sesión…
        </>
      ) : (
        children
      )}
    </button>
  );
}
