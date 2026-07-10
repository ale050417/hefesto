-- 0041: notificaciones para el ADMIN (pedidos nuevos, stock bajo, mensajes).
-- El sistema de avisos existente era solo para clientes (customer_id NOT NULL).
-- Se generaliza:
--  - customer_id pasa a NULLABLE: las notificaciones de admin no apuntan a un
--    cliente (son broadcast al staff).
--  - audience distingue el destinatario: 'customer' (las de siempre) | 'admin'.
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS), como 0032/0039/0040.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "audience" text NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audience_valid" CHECK ("audience" IN ('customer','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_audience_idx" ON "notifications" USING btree ("audience","is_read");--> statement-breakpoint
-- Realtime: que los INSERT de notificaciones lleguen por websocket (la campana
-- del admin se actualiza al instante). Si el rol no puede alterar la publicación,
-- NO falla: se agrega a mano en el Dashboard y mientras tanto hay polling 30s.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN RAISE NOTICE 'publicación supabase_realtime inexistente (¿local?)';
  WHEN insufficient_privilege THEN RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá notifications desde el Dashboard';
END $$;
