-- 0085: avisos del panel por TIPO, apagables por persona, y avisos push al
-- celular / la compu (sugerencia de Agustín, 2026-11-22: "siempre pasa
-- desapercibido el símbolo de notificaciones").
--
-- 1. notifications.kind: qué tipo de aviso es (consulta nueva, pedido, stock
--    bajo…). notifications.actor_id: quién lo generó (a esa persona no se le
--    avisa lo que acaba de hacer).
-- 2. notification_prefs: por persona, qué tipos apagó y hasta cuándo leyó.
--    Antes "leído" era uno solo para todo el equipo: si uno abría la campana,
--    al resto se le borraba el numerito.
-- 3. push_subscriptions: los dispositivos que aceptaron recibir avisos.

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "kind" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_id" uuid;
--> statement-breakpoint
-- Los avisos viejos se clasifican por a dónde llevan.
UPDATE "notifications" SET "kind" = CASE
    WHEN "link" LIKE '/admin/consultas%' AND "title" ILIKE '%respondida%' THEN 'inquiry_answered'
    WHEN "link" LIKE '/admin/consultas%' AND "title" ILIKE '%confirmada%' THEN 'inquiry_confirmed'
    WHEN "link" LIKE '/admin/consultas%' THEN 'inquiry'
    WHEN "link" LIKE '/admin/pedidos%' AND "title" ILIKE 'mensaje%' THEN 'message'
    WHEN "link" LIKE '/admin/pedidos%' THEN 'order'
    WHEN "link" LIKE '/admin/filamentos%' THEN 'low_stock'
    WHEN "link" LIKE '/admin/arreglos%' THEN 'fix'
    ELSE 'other'
  END
WHERE "audience" = 'admin' AND "kind" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_prefs" (
  "profile_id" uuid PRIMARY KEY NOT NULL,
  "muted_kinds" text[] DEFAULT '{}'::text[] NOT NULL,
  "seen_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_profile_id_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_profile_id_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_profile_idx" ON "push_subscriptions" ("profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_admin_created_idx" ON "notifications" ("audience", "created_at");
--> statement-breakpoint
-- Tablas internas: RLS activado y sin políticas (la API pública no las ve).
ALTER TABLE "notification_prefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
