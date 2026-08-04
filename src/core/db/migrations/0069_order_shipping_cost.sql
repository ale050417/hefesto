-- 0069: costo de envío en el pedido (2026-08-03).
--
-- Hasta ahora el envío se coordinaba aparte y el pedido solo guardaba la
-- mercadería. Desde el rediseño del checkout, quien vive en la ciudad del
-- taller elige su BARRIO y ese costo se cobra junto con la compra:
--
--     total = subtotal - descuento + envío
--
-- Va en su propia columna, no sumado al subtotal, por tres motivos concretos:
--   1. Ganancias y Reportes miden lo que se vendió; un envío de $1.000 metido
--      dentro del subtotal inflaría la venta y ensuciaría el margen.
--   2. El cliente tiene que ver el desglose ("Productos $20.000 + Envío
--      $1.000"), como en cualquier tienda seria.
--   3. Si mañana cambia el precio del barrio, los pedidos viejos conservan lo
--      que se cobró de verdad (snapshot, igual que el precio de cada ítem).
--
-- DEFAULT 0 + NOT NULL: los pedidos anteriores quedan en 0, que es exactamente
-- lo que pasó con ellos (no se cobró envío). Nada que rellenar a mano.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(12, 2) NOT NULL DEFAULT 0;

-- Un envío negativo sería un descuento encubierto: no existe.
DO $$
BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_shipping_non_negative CHECK (shipping_cost >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
