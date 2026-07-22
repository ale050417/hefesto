-- Duración configurable entre banners del hero (H28, 2026-07): segundos de
-- autoplay del carrusel. Default 5; el mínimo/máximo (3-12s) se validan en el
-- servidor para que no quede demasiado rápido ni demasiado lento. Idempotente.
ALTER TABLE "business_settings" ADD COLUMN IF NOT EXISTS "banner_interval_sec" integer NOT NULL DEFAULT 5;
