-- 0076: banners del hero generados por IA (2026-10-21).
--
-- Cada ~10 días un cron (o el botón "Renovar con IA" de Config → Tienda)
-- arma 3 banners con los productos nuevos / más vendidos y el copy lo
-- escribe Claude. Acá quedan los ids de esos banners y la última corrida:
-- la corrida siguiente borra SOLO esos y deja intactos los del dueño.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS auto_banners jsonb;
