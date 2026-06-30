// Definiciones PURAS de permisos (sin imports de servidor: se pueden usar en
// componentes cliente y en tests). La lógica server (can/requirePermissionPage,
// que tocan DB/sesión) vive en ./permissions.

// Cada módulo = una sección del panel. El tick "ver" controla si aparece en el
// sidebar y si se puede entrar a la página; crear/editar/eliminar controlan las
// acciones dentro. (Categorías va junto con Productos.)
export const PERM_MODULES = [
  ["productos", "Productos y categorías"],
  ["pedidos", "Pedidos"],
  ["medida", "Pedidos a medida"],
  ["clientes", "Clientes"],
  ["produccion", "Cola de producción"],
  ["filamentos", "Filamentos"],
  ["fallas", "Impresiones fallidas"],
  ["descuentos", "Descuentos"],
  ["recompensas", "Recompensas"],
  ["resenas", "Reseñas"],
  ["reportes", "Reportes"],
  ["ganancias", "Ganancias y socios"],
  ["calculadora", "Calculadora"],
  ["config", "Configuración"],
  ["auditoria", "Auditoría"],
] as const;

export const PERM_ACTIONS = ["ver", "crear", "editar", "eliminar"] as const;

export type PermModule = (typeof PERM_MODULES)[number][0];
export type PermAction = (typeof PERM_ACTIONS)[number];

/** Solo las claves (para iterar en el sidebar / layout). */
export const PERM_MODULE_KEYS = PERM_MODULES.map(([k]) => k) as PermModule[];

const CRUD: PermAction[] = ["ver", "crear", "editar", "eliminar"];

/**
 * Permisos del rol "Operador" de sistema cuando se crea por primera vez:
 * operador completo (acceso total operativo). El admin lo puede recortar después
 * (el rol Operador es editable) o crear roles propios más limitados.
 */
export const DEFAULT_OPERATOR: Record<PermModule, PermAction[]> =
  Object.fromEntries(PERM_MODULE_KEYS.map((k) => [k, CRUD])) as Record<
    PermModule,
    PermAction[]
  >;

/** Los 4 permisos de un módulo, para gatear controles en la UI. */
export type ModulePerms = {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

export type ResolveInput = {
  enumRole: "customer" | "operator" | "admin" | null | undefined;
  /** Rol custom asignado (o null si no tiene). */
  role: { isAdmin: boolean; permissions: Record<string, string[]> } | null;
};

/**
 * Resuelve si un usuario puede hacer `action` en `module`. PURO y testeable.
 */
export function resolveAllowed(
  input: ResolveInput,
  module: PermModule,
  action: PermAction,
): boolean {
  if (input.enumRole === "admin") return true;
  if (input.enumRole !== "operator") return false;
  if (input.role?.isAdmin) return true;
  // El operador ve SOLO lo que tenga marcado su rol asignado. Sin rol custom
  // (role_id nulo) no tiene permisos (deny-by-default): así "solo lo marcado".
  const perms = input.role?.permissions ?? {};
  return (perms[module] ?? []).includes(action);
}
