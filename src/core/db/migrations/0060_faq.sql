-- FAQ del home editable (2026-07): las preguntas frecuentes se guardan acá para
-- poder editarlas desde Config → Tienda. Null/vacío = usa las preguntas por
-- defecto del home. Idempotente para poder reintentar.
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "faq" jsonb;
