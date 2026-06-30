import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/core/db";
import { roles } from "@/core/db/schema";
import { getCurrentUser, type CurrentUser } from "./session";
import {
  PERM_MODULE_KEYS,
  resolveAllowed,
  type PermAction,
  type PermModule,
  type ResolveInput,
} from "./perm-defs";

// Re-export de las defs puras para los callers server (un solo import).
export {
  DEFAULT_OPERATOR,
  PERM_ACTIONS,
  PERM_MODULES,
  resolveAllowed,
  type PermAction,
  type PermModule,
  type ResolveInput,
} from "./perm-defs";

/**
 * Autorización fina por módulo/acción. Capa de aplicación (servidor) ENCIMA del
 * enum de acceso: el enum decide quién entra al panel (RLS), el rol custom
 * decide qué puede hacer adentro.
 */

/**
 * Lee el rol custom del usuario (o null) para resolver permisos. Cacheado por
 * request: el layout (sidebar) y el guard de la página comparten una sola
 * consulta de rol por render.
 */
const loadResolveInput = cache(async function loadResolveInput(
  user: CurrentUser | null,
): Promise<ResolveInput> {
  if (!user) return { enumRole: null, role: null };
  const enumRole = user.profile?.role ?? null;
  const roleId = user.profile?.roleId ?? null;
  if (!roleId) return { enumRole, role: null };
  const [row] = await db
    .select({ isAdmin: roles.isAdmin, permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  return {
    enumRole,
    role: row ? { isAdmin: row.isAdmin, permissions: row.permissions } : null,
  };
});

/**
 * ¿El usuario actual es admin (dueño)? True si su enum de acceso es `admin` o si
 * su rol custom tiene `is_admin`. Para features que solo el dueño controla
 * (ej: márgenes de la calculadora), independientes de la matriz de permisos.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  const input = await loadResolveInput(user);
  return input.enumRole === "admin" || input.role?.isAdmin === true;
}

/** ¿El usuario actual puede `action` en `module`? */
export async function can(
  module: PermModule,
  action: PermAction,
): Promise<boolean> {
  const user = await getCurrentUser();
  const input = await loadResolveInput(user);
  return resolveAllowed(input, module, action);
}

/**
 * Resuelve el permiso de "ver" de varios módulos en UNA sola pasada (un
 * getCurrentUser + una consulta de rol). Para el sidebar, que necesita todos.
 */
export async function canViewModules(
  modules: PermModule[],
): Promise<Record<string, boolean>> {
  const user = await getCurrentUser();
  const input = await loadResolveInput(user);
  const out: Record<string, boolean> = {};
  for (const m of modules) out[m] = resolveAllowed(input, m, "ver");
  return out;
}

/**
 * Devuelve los 4 permisos de un módulo (ver/crear/editar/eliminar) en una sola
 * pasada (un getCurrentUser + una consulta de rol cacheada). Para que las páginas
 * pasen a sus componentes qué controles mostrar/ocultar.
 */
export async function getModulePerms(
  module: PermModule,
): Promise<import("./perm-defs").ModulePerms> {
  const user = await getCurrentUser();
  const input = await loadResolveInput(user);
  return {
    ver: resolveAllowed(input, module, "ver"),
    crear: resolveAllowed(input, module, "crear"),
    editar: resolveAllowed(input, module, "editar"),
    eliminar: resolveAllowed(input, module, "eliminar"),
  };
}

/** Mapa completo módulo → {ver,crear,editar,eliminar} para el contexto de UI. */
export type AllPerms = Record<string, import("./perm-defs").ModulePerms>;
export async function getAllPerms(): Promise<AllPerms> {
  const user = await getCurrentUser();
  const input = await loadResolveInput(user);
  const out: AllPerms = {};
  for (const m of PERM_MODULE_KEYS) {
    out[m] = {
      ver: resolveAllowed(input, m, "ver"),
      crear: resolveAllowed(input, m, "crear"),
      editar: resolveAllowed(input, m, "editar"),
      eliminar: resolveAllowed(input, m, "eliminar"),
    };
  }
  return out;
}

/**
 * Exige el permiso en una página (server component). Sin sesión → login;
 * sin permiso → home. Para guards de navegación.
 */
export async function requirePermissionPage(
  module: PermModule,
  action: PermAction,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?redirect=/admin");
  if (user.profile?.mustChangePassword) redirect("/cuenta/cambiar-clave");
  const input = await loadResolveInput(user);
  if (!resolveAllowed(input, module, action)) redirect("/admin");
  return user;
}

/** Guard para server actions: devuelve true/false (la action arma el error). */
export async function hasPermission(
  module: PermModule,
  action: PermAction,
): Promise<boolean> {
  return can(module, action);
}
