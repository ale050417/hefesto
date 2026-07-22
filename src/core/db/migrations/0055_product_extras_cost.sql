-- Insumos online (2026-07): el costo de los insumos del producto (vaso,
-- argollas, etc.) se guarda APARTE del precio. El precio ya los incluye (el
-- cliente los paga), pero antes ese costo no se descontaba en ningún lado →
-- inflaba la ganancia. Con esta columna, la amortización del pedido lo resta.
-- Idempotente (IF NOT EXISTS) para poder reintentar.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "extras_cost" numeric(12, 2) DEFAULT '0' NOT NULL;
