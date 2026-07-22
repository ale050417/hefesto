-- Imagen por categoría (G23, 2026-07): además del ícono, cada categoría puede
-- tener una foto (URL de Storage). Nullable = usa el ícono como hasta ahora.
-- Idempotente para poder reintentar.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_url" text;
