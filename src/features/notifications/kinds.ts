import {
  resolveAllowed,
  type PermModule,
  type ResolveInput,
} from "@/core/auth/perm-defs";

/**
 * Tipos de aviso del panel (sugerencia de Agustín, 2026-11-22: "un apartado
 * donde se pueda activar y desactivar tipos de notificaciones"). Puro: lo usan
 * el servidor, la campana y los tests.
 *
 * Cada tipo se le muestra solo a quien puede VER el módulo del que habla
 * (`module`); `adminOnly` es para lo que solo le importa al dueño.
 */
export type AdminNotificationKind =
  | "inquiry"
  | "inquiry_answered"
  | "inquiry_confirmed"
  | "order"
  | "message"
  | "low_stock"
  | "fix"
  | "calc_preset"
  | "other";

type KindDef = {
  key: AdminNotificationKind;
  label: string;
  description: string;
  module?: PermModule;
  adminOnly?: boolean;
};

export const ADMIN_NOTIFICATION_KINDS: KindDef[] = [
  {
    key: "inquiry",
    label: "Consultas nuevas",
    description: "Cuando atención al cliente carga una consulta para cotizar.",
    module: "consultas",
  },
  {
    key: "inquiry_answered",
    label: "Consultas respondidas",
    description: "Cuando el operador le pone precio a una consulta.",
    module: "consultas",
  },
  {
    key: "inquiry_confirmed",
    label: "Consultas confirmadas",
    description: "Cuando una consulta se confirma y pasa a ser un pedido.",
    module: "consultas",
  },
  {
    key: "order",
    label: "Pedidos nuevos",
    description: "Cuando entra un pedido por la tienda.",
    module: "pedidos",
  },
  {
    key: "message",
    label: "Mensajes de clientes",
    description: "Cuando un cliente escribe en su pedido.",
    module: "pedidos",
  },
  {
    key: "low_stock",
    label: "Stock bajo de filamento",
    description: "Cuando un color queda bajo el mínimo o falta para un pedido.",
    module: "filamentos",
  },
  {
    key: "fix",
    label: "Arreglos",
    description: "Arreglos nuevos del equipo y sus novedades.",
    module: "arreglos",
  },
  {
    key: "calc_preset",
    label: "Tipos nuevos en la calculadora",
    description: "Cuando alguien crea un tipo de producto para cotizar.",
    adminOnly: true,
  },
  {
    key: "other",
    label: "Otros avisos",
    description: "Avisos generales del panel.",
  },
];

const KEYS = new Set<string>(ADMIN_NOTIFICATION_KINDS.map((k) => k.key));

export function isAdminNotificationKind(
  key: string,
): key is AdminNotificationKind {
  return KEYS.has(key);
}

/** Un aviso sin tipo (o con uno que ya no existe) cuenta como "other". */
export function kindOf(raw: string | null | undefined): AdminNotificationKind {
  return raw && isAdminNotificationKind(raw) ? raw : "other";
}

/** Tipos que esta persona puede ver, según sus permisos del panel. */
export function visibleKinds(input: ResolveInput): AdminNotificationKind[] {
  const admin = input.enumRole === "admin" || input.role?.isAdmin === true;
  return ADMIN_NOTIFICATION_KINDS.filter((k) => {
    if (k.adminOnly) return admin;
    if (k.module) return resolveAllowed(input, k.module, "ver");
    return input.enumRole === "admin" || input.enumRole === "operator";
  }).map((k) => k.key);
}

/** Tipos que le llegan: los que puede ver menos los que apagó. */
export function activeKinds(
  input: ResolveInput,
  muted: readonly string[],
): AdminNotificationKind[] {
  const off = new Set(muted);
  return visibleKinds(input).filter((k) => !off.has(k));
}

export type KindPref = {
  key: AdminNotificationKind;
  label: string;
  description: string;
  enabled: boolean;
};

/** Lista para la pantalla "Qué avisos recibir". */
export function kindPrefs(
  input: ResolveInput,
  muted: readonly string[],
): KindPref[] {
  const visible = new Set(visibleKinds(input));
  const off = new Set(muted);
  return ADMIN_NOTIFICATION_KINDS.filter((k) => visible.has(k.key)).map(
    (k) => ({
      key: k.key,
      label: k.label,
      description: k.description,
      enabled: !off.has(k.key),
    }),
  );
}
