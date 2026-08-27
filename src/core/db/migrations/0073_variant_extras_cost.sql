-- 0073: costo de insumo POR TAMAÑO/combinación (2026-08-27, pedido de Ale).
--
-- El caso real: el Chop de River tiene dos tamaños (500cc y 1L) y cada uno
-- lleva un VASO distinto, con distinto costo. Hasta ahora el insumo vivía solo
-- en products.extras_cost (un único valor por producto), así que ambos tamaños
-- costeaban el mismo vaso y la ganancia salía mal en uno de los dos.
--
-- NULL = usar el extras_cost del producto (todo lo ya cargado sigue igual);
-- un valor (incluido 0) = este tamaño define su propio insumo.

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "extras_cost" numeric(12, 2);

DO $$
BEGIN
  ALTER TABLE product_variants
    ADD CONSTRAINT variants_extras_cost_non_negative
    CHECK (extras_cost IS NULL OR extras_cost >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
