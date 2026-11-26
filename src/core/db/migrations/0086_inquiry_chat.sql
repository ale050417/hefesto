-- 0086: chat en vivo dentro de cada consulta (pedido de Ale, 2026-11-25).
--
-- La vendedora carga la consulta de un cliente y ahí mismo conversa con el
-- operador (texto y fotos) hasta dejar todo definido: tamaño, colores, etc.
-- Cuando el operador modela y saca el precio toca "Crear cotización": se crea
-- el pedido en "pendiente de pago" (eso lo hace el código, sin cambios de
-- esquema: ya existía inquiries.sale_id).
--
-- 1. inquiry_messages: los mensajes. Un mensaje lleva texto, una foto o ambos.
--    El nombre del autor se guarda como texto (se entiende aunque la cuenta
--    se borre).
-- 2. inquiry_reads: hasta cuándo leyó cada persona cada conversación (para el
--    numerito de mensajes sin leer en la lista).

CREATE TABLE IF NOT EXISTS "inquiry_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inquiry_id" uuid NOT NULL,
  "author_id" uuid,
  "author_name" text,
  "body" text DEFAULT '' NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inquiry_messages_not_empty" CHECK ("body" <> '' OR "image" IS NOT NULL),
  CONSTRAINT "inquiry_messages_body_length" CHECK (char_length("body") <= 2000)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiry_id_inquiries_id_fk"
    FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_author_id_profiles_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_messages_inquiry_idx" ON "inquiry_messages" ("inquiry_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiry_reads" (
  "inquiry_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "read_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inquiry_reads_pk" PRIMARY KEY ("inquiry_id", "profile_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiry_reads" ADD CONSTRAINT "inquiry_reads_inquiry_id_inquiries_id_fk"
    FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiry_reads" ADD CONSTRAINT "inquiry_reads_profile_id_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Tablas internas del panel: RLS activado y sin políticas (la API pública no
-- las ve; la app entra con un rol que saltea RLS).
ALTER TABLE "inquiry_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inquiry_reads" ENABLE ROW LEVEL SECURITY;
