import { pgEnum } from "drizzle-orm/pg-core";

// Estado de publicación de un producto (Cap. 10).
export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "archived",
]);

// Roles de usuario (Cap. 13). El rol inicial siempre es customer.
export const userRole = pgEnum("user_role", ["customer", "operator", "admin"]);

// Máquina de estados del pedido (Cap. 2.5 / 11).
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentMethod = pgEnum("payment_method", [
  "transfer",
  "mercadopago",
  "cash",
]);
