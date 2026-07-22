-- MercadoPago conectable (2026-07): el vendedor pega su Access Token desde
-- Config → Métodos de pago (en vez de depender de una variable de entorno).
-- Se usa server-side en el checkout; nunca se expone al cliente. Idempotente.
ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "mp_access_token" text;
