-- Galería curada del home (2026-07): fotos de impresiones reales que el dueño
-- sube desde Config → Tienda. Array jsonb de { url }. Null/vacío = sin galería.
-- Idempotente para poder reintentar.
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "gallery" jsonb;
