-- Motivo de cancelación/reembolso (2026-07): al pasar un pedido o venta manual
-- a "cancelado" o "reembolsado", el operador puede dejar el motivo (opcional):
-- uno estándar o texto libre. Se muestra en el detalle. Idempotente.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
ALTER TABLE "manual_sales" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
