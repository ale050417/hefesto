-- Peso por tamaño en COLOR ÚNICO (2026-07): cada tamaño (variante) de un
-- producto de un solo color pesa distinto. Se carga desde el wizard (botón
-- "Gramos" por tamaño) y el stock descuenta ese peso sobre el color elegido.
-- Nullable: si un tamaño no lo tiene, se usa el peso del producto. Idempotente.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "weight_grams" numeric(10, 2);
