-- 0041: notificaciones para el ADMIN (pedidos nuevos, stock bajo, mensajes).
-- El sistema de avisos existente era solo para clientes (customer_id NOT NULL).
-- Se generaliza:
--  - customer_id pasa a NULLABLE: las notificaciones de admin no apuntan a un
--    cliente (son broadcast al staff).
--  - audience distingue el destinatario: 'customer' (las de siempre) | 'admin'.
-- Idempotente (IF NOT EXISTS). Solo DDL de tabla (corre dentro de la
-- transacción del migrador sin problemas).
--
-- REALTIME (opcional): para que la campana del admin se actualice al instante,
-- agregá la tabla `notifications` a la publicación en el Dashboard de Supabase:
--   Database → Publications → supabase_realtime → activar `notifications`.
-- NO va en esta migración porque `ALTER PUBLICATION` no puede ejecutarse dentro
-- de una transacción (el migrador envuelve cada migración en una). Sin esto la
-- campana igual funciona por polling cada 30 s.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "audience" text NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audience_valid" CHECK ("audience" IN ('customer','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_audience_idx" ON "notifications" USING btree ("audience","is_read");
