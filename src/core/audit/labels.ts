/**
 * Traducción de los códigos de acción de la auditoría a castellano. Fuente
 * única: la usan la página web `/admin/auditoria` y la API de la app
 * (`/api/v1/admin/auditoria`, que además busca por estos textos: escribir
 * "pedido" encuentra "order.*"). Sin imports de servidor, así se testea suelta.
 */
export const ACTION_LABEL: Record<string, string> = {
  "order.status_changed": "Cambió estado de pedido",
  "order.meta_updated": "Editó datos de pedido",
  "product.created": "Creó un producto",
  "product.updated": "Editó un producto",
  "product.deleted": "Borró un producto",
  "category.created": "Creó una categoría",
  "category.updated": "Editó una categoría",
  "category.deleted": "Borró una categoría",
  "coupon.created": "Creó un cupón",
  "coupon.updated": "Editó un cupón",
  "coupon.deleted": "Borró un cupón",
  "reward.created": "Creó una recompensa",
  "reward.updated": "Editó una recompensa",
  "reward.deleted": "Borró una recompensa",
  "settings.updated": "Cambió la configuración",
  // Faltaban (se veían crudas, ej. "manual_sale.created"; 2026-10-21).
  "order.deleted": "Borró un pedido",
  "order.bulk_deleted": "Borró varios pedidos",
  "manual_sale.created": "Cargó una venta manual",
  "manual_sale.updated": "Editó una venta manual",
  "manual_sale.deleted": "Borró una venta manual",
  "manual_sale.imported": "Importó ventas manuales",
  "manual_sale.status_changed": "Cambió estado de venta manual",
  "sales.bulk_deleted": "Borró varias ventas",
  "product.published": "Publicó un producto",
  "product.archived": "Archivó un producto",
  "inventory.failure_registered": "Registró una impresión fallida",
  "inventory.failure_deleted": "Borró una impresión fallida",
  "fix.created": "Cargó un arreglo",
  "fix.updated": "Cambió el estado de un arreglo",
  "fix.deleted": "Borró un arreglo",
  "inventory.order_deduct_failed": "Falló el descuento de stock de un pedido",
  "inventory.order_deduct_partial": "Descuento de stock parcial en un pedido",
  "inventory.order_restore_failed": "Falló la reposición de stock de un pedido",
  "inventory.manual_sale_deduct_failed":
    "Falló el descuento de stock de una venta manual",
  "inventory.manual_sale_no_deduct": "Venta manual sin descuento de stock",
  "team.invite_resent": "Reenvió una invitación al equipo",
  // Estas dos se registran desde siempre pero no tenían texto (2026-10-31).
  "team.member_invited": "Invitó a una persona al equipo",
  "team.member_promoted": "Dio acceso al panel a un cliente",
  // Las registra la API de la app (2026-10-31).
  "inventory.filament_created": "Cargó un filamento",
  "inventory.filament_updated": "Editó un filamento",
  "inventory.filament_deleted": "Borró un filamento",
  "inventory.stock_adjusted": "Ajustó el stock de un filamento",
  "profit_shares.updated": "Cambió el reparto entre socios",
  "cost_settings.updated": "Cambió los costos de producción",
  // La registra la baja de cuenta desde la app (2026-11-14).
  "account.deleted": "Un cliente eliminó su cuenta",
};

/** Clave desconocida → texto legible igual ("order.x_y" → "Order: x y"). */
export function labelOf(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const [scope, ...rest] = action.split(".");
  const verb = rest.join(" ").replace(/_/g, " ");
  const head = (scope ?? action).replace(/_/g, " ");
  return `${head.charAt(0).toUpperCase()}${head.slice(1)}${verb ? `: ${verb}` : ""}`;
}
