-- 0082: consultas costeadas con la calculadora (2026-11-17, pedido de Ale).
--
-- El operador saca el precio con la calculadora (elige el TIPO de producto,
-- que lleva el porcentaje que carga Ale) y acá queda lo que cargó, por unidad.
-- Al confirmar la consulta, la venta se costea con esto y descuenta el
-- filamento, en vez de pedirle al operador un costo escrito a mano.

ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "est_filament_id" uuid;
--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "est_material" text;
--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "est_grams" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "est_minutes" integer;
