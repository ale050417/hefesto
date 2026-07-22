-- Banda de confianza del home editable (H25, 2026-07): los 4 ítems (ícono +
-- título + texto) se guardan acá para poder editarlos desde Config. Null = se
-- usan los textos por defecto del home. Idempotente para poder reintentar.
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "trust_bar" jsonb;
