-- 0074: cada línea de una venta manual sabe de QUÉ producto es (2026-09-21,
-- pedido de Ale: "seleccionar más de un producto en la misma carga manual").
--
-- Hasta acá `manual_sale_items` servía para UN producto con varias
-- combinaciones de colores (los 10 Dumplings). Si el cliente se llevaba 7
-- porta sahumerios Y dos llaveros, había que cargar dos ventas: la venta
-- tenía un solo `product_id` (en manual_sales) y las líneas no decían de qué
-- producto eran.
--
-- Con estas dos columnas la venta puede mezclar productos: cada línea lleva
-- su `product_id` (para que "más vendidos" sume a cada uno) y un snapshot del
-- nombre (`product_name`), igual que order_items: si el producto se renombra
-- o se borra, la venta sigue diciendo qué se vendió.
--
-- Las ventas ya cargadas no cambian: sus líneas quedan con product_id NULL y
-- el producto sigue siendo el de la venta (manual_sales.product_id).

ALTER TABLE manual_sale_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE manual_sale_items
  ADD COLUMN IF NOT EXISTS product_name text;

CREATE INDEX IF NOT EXISTS manual_sale_items_product_idx
  ON manual_sale_items (product_id);
