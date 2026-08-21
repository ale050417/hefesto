-- 0072: líneas de la venta manual — varias combinaciones de colores en UNA
-- sola venta (2026-08-09, pedido de Ale).
--
-- El caso real: se venden 10 Dumplings, pero cada uno de una combinación de
-- colores distinta. Hasta ahora `manual_sales` asume "N unidades IDÉNTICAS"
-- (un precio unitario, un juego de gramos, repetido `quantity` veces), así que
-- había que cargar 10 ventas separadas: buscar el producto, elegir color,
-- cantidad 1, guardar. Diez veces.
--
-- Con esta tabla la venta sigue siendo UNA fila en Pedidos (fecha, cliente,
-- pago, estado) y adentro lleva el desglose por combinación. El `total` de la
-- venta y los gramos a descontar del stock se CALCULAN sumando estas líneas
-- (helpers puros `manualSaleTotals` / `consolidateGrams`, testeados).
--
-- Las ventas simples NO usan esta tabla: sin líneas, todo funciona como antes.
-- Por eso nada de lo ya cargado se toca ni se migra.
--
-- ON DELETE CASCADE: las líneas no tienen sentido sin su venta (igual criterio
-- que order_items). Borrar la venta se las lleva.

CREATE TABLE IF NOT EXISTS manual_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_sale_id uuid NOT NULL REFERENCES manual_sales(id) ON DELETE CASCADE,
  variant_label text,
  color text,
  quantity integer NOT NULL,
  unit_price numeric(12, 2) NOT NULL,
  line_total numeric(12, 2) NOT NULL,
  color_lines jsonb
);

-- Una línea de 0 unidades no es una venta; un precio negativo tampoco existe.
DO $$
BEGIN
  ALTER TABLE manual_sale_items
    ADD CONSTRAINT manual_sale_items_quantity_positive CHECK (quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE manual_sale_items
    ADD CONSTRAINT manual_sale_items_unit_price_non_negative CHECK (unit_price >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS manual_sale_items_sale_idx ON manual_sale_items (manual_sale_id);
