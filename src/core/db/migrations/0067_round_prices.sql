-- 0067: precios REDONDOS en todo el catálogo (pedido de Ale 2026-07-24).
-- Números tipo 20000 / 20100 dan confianza; 1231234 no. Regla: múltiplo de
-- $100. Los precios se redondean HACIA ARRIBA (nunca cobrar menos que lo
-- calculado); las OFERTAS hacia abajo (a favor del cliente y respeta el check
-- sale_price < price). NO se toca ningún dato de gramos:
--   products.color_prices  → solo en color_mode='single' (en multi son GRAMOS)
--   product_variants.color_grams → NUNCA (siempre gramos)
-- Idempotente: redondear un precio ya redondo no lo cambia.

-- Precio base del producto: hacia arriba.
UPDATE products
SET price = CEIL(price / 100.0) * 100
WHERE price > 0 AND price <> CEIL(price / 100.0) * 100;

-- Oferta: hacia abajo (sigue > 0 y < price por las condiciones).
UPDATE products
SET sale_price = FLOOR(sale_price / 100.0) * 100
WHERE sale_price IS NOT NULL
  AND FLOOR(sale_price / 100.0) * 100 > 0
  AND FLOOR(sale_price / 100.0) * 100 < price
  AND sale_price <> FLOOR(sale_price / 100.0) * 100;

-- Precio por tamaño/combinación: hacia arriba.
UPDATE product_variants
SET price_override = CEIL(price_override / 100.0) * 100
WHERE price_override IS NOT NULL
  AND price_override > 0
  AND price_override <> CEIL(price_override / 100.0) * 100;

-- Matriz tamaño × color (SIEMPRE son precios): hacia arriba.
UPDATE product_variants
SET color_prices = (
  SELECT jsonb_object_agg(kv.key, to_jsonb(CEIL(kv.value::numeric / 100.0) * 100))
  FROM jsonb_each_text(color_prices) AS kv(key, value)
)
WHERE color_prices IS NOT NULL AND color_prices <> '{}'::jsonb;

-- Precio por color del producto: SOLO color único (en multicolor son gramos).
UPDATE products
SET color_prices = (
  SELECT jsonb_object_agg(kv.key, to_jsonb(CEIL(kv.value::numeric / 100.0) * 100))
  FROM jsonb_each_text(color_prices) AS kv(key, value)
)
WHERE color_mode = 'single'
  AND color_prices IS NOT NULL
  AND color_prices <> '{}'::jsonb;
