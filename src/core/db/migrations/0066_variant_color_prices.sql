-- Matriz tamaño × color (2026-07): el precio puede variar por tamaño Y por
-- color a la vez (el tamaño cambia los gramos; el color cambia el costo del
-- filamento). Cada variante (tamaño) puede tener su precio POR color.
-- Nullable: sin matriz se usa el precio del tamaño / del color / base. Idempotente.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "color_prices" jsonb;
