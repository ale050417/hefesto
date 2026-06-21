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

// Tipo de cupón (Strategy: % o monto fijo).
export const couponType = pgEnum("coupon_type", ["percentage", "fixed"]);

// Estado de un pedido a medida.
export const customRequestStatus = pgEnum("custom_request_status", [
  "pending",
  "quoted",
  "approved",
  "in_production",
  "done",
  "rejected",
]);

// Estado de una impresora.
export const printerStatus = pgEnum("printer_status", [
  "idle",
  "printing",
  "maintenance",
  "offline",
]);

// Estado de un trabajo de impresión.
export const printJobStatus = pgEnum("print_job_status", [
  "queued",
  "printing",
  "done",
  "failed",
]);
