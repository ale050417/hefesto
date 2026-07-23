-- Gramos por color POR tamaño (2026-07): cada tamaño (variante) de un producto
-- multicolor consume material distinto. Se cargan desde el wizard (botón
-- "Gramos" por tamaño) y el stock descuenta esos gramos según el tamaño vendido.
-- Nullable: si un tamaño no los tiene, se usan los gramos del producto. Idempotente.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "color_grams" jsonb;
