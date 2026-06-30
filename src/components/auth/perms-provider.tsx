"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AllPerms } from "@/core/auth/permissions";

/**
 * Contexto de permisos del usuario para la UI del panel. Se calcula UNA vez en
 * el layout (server) y se provee acá; cualquier componente cliente usa `useCan`
 * para ocultar/deshabilitar controles según ver/crear/editar/eliminar.
 *
 * OJO: esto es solo para la UI (que no muestre lo que no podés hacer). La
 * seguridad real está en el servidor (cada server action chequea el permiso).
 */
const PermsContext = createContext<AllPerms>({});

export function PermsProvider({
  value,
  children,
}: {
  value: AllPerms;
  children: ReactNode;
}) {
  return (
    <PermsContext.Provider value={value}>{children}</PermsContext.Provider>
  );
}

type Action = "ver" | "crear" | "editar" | "eliminar";

/** ¿El usuario puede `action` en `module`? Para gatear botones/controles. */
export function useCan(module: string, action: Action): boolean {
  const perms = useContext(PermsContext);
  return perms[module]?.[action] ?? false;
}
