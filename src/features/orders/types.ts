import type { orderItems, orderStatusHistory, orders } from "@/core/db/schema";

// Tipos inferidos del schema de Drizzle: fuente única de verdad.
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type NewOrderStatusHistory = typeof orderStatusHistory.$inferInsert;
export type OrderStatus = Order["status"];
export type PaymentMethod = Order["paymentMethod"];

// Pedido con sus líneas y su historial (para la vista de detalle / confirmación).
export type OrderWithItems = Order & {
  items: OrderItem[];
  history: OrderStatusHistory[];
};

// DTO de vista para la lista de pedidos del admin.
export type OrderListItem = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  paymentMethod: PaymentMethod;
  total: number;
  status: OrderStatus;
  createdAt: Date;
  /** Resumen de lo pedido (productos + cantidades), para mostrar en la tabla. */
  itemsSummary: string;
};
