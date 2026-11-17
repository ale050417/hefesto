-- 0080: consultas con audios/archivos y pedido automático (2026-11-17, Ale).
--
-- "que Antonella pueda mandar imágenes, audios, etc." → `files`: adjuntos que
-- no son fotos (el audio que mandó el cliente, un PDF, un video corto).
-- "si confirma, que el pedido pase solo a pedido confirmado" → al confirmar se
-- crea la venta; `sale_id` la deja enlazada y `unit_cost` es el costo que
-- cargó el operador al responder (la venta no se registra con costo 0).

ALTER TABLE "inquiries"
  ADD COLUMN IF NOT EXISTS "files" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "inquiries"
  ADD COLUMN IF NOT EXISTS "unit_cost" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "inquiries"
  ADD COLUMN IF NOT EXISTS "sale_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_sale_id_manual_sales_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "public"."manual_sales"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
