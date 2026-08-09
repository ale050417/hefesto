-- 0071: producto real de catálogo en la venta manual (2026-08-09).
--
-- Al cargar una venta manual, el form ya deja "Cargar desde un producto de la
-- tienda" (elegís variante y color), pero esa elección se perdía en `detail`
-- (texto libre) — no había forma de saber por query "esta venta corresponde
-- al producto X". Ale quiere que "Más vendidos" del home cuente TAMBIÉN el
-- mostrador, no solo pedidos online: para eso hace falta el id real.
--
-- Nullable + ON DELETE SET NULL: ventas de texto libre, importaciones o
-- cargas viejas (previas a esta columna) no lo tienen y se borra un producto
-- sin romper el historial de ventas (mismo criterio que order_items.product_id).

ALTER TABLE manual_sales
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS manual_sales_product_idx ON manual_sales (product_id);
