-- 0077: sección "Arreglos" del panel (2026-11-17, pedido de Ale).
--
-- El operador carga lo que hay que arreglar o mejorar (texto + fotos) y al
-- dueño le llega para ver qué hacer. Las fotos van al bucket de imágenes con
-- el prefijo arreglos/ y acá queda la lista de URLs.

CREATE TABLE IF NOT EXISTS "fix_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "urgent" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "owner_note" text,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "fix_requests_status_valid" CHECK ("status" IN ('pending', 'in_progress', 'done'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fix_requests" ADD CONSTRAINT "fix_requests_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fix_requests_status_idx" ON "fix_requests" ("status", "created_at");
--> statement-breakpoint
-- Tabla interna del panel: RLS activado y sin políticas => la API pública
-- (anon / authenticated) no puede leerla ni tocarla. La app entra con un rol
-- que saltea RLS.
ALTER TABLE "fix_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Los roles que ya existen no conocen el módulo nuevo y el operador ve SOLO lo
-- que tiene marcado: sin esto la sección no le aparecería. Se les da "ver" y
-- "crear" (cargar arreglos); cambiar el estado o borrar queda para el dueño,
-- que después lo puede ampliar desde Configuración → Roles.
UPDATE "roles"
SET "permissions" = "permissions" || '{"arreglos": ["ver", "crear"]}'::jsonb
WHERE "is_admin" = false
  AND NOT jsonb_exists("permissions", 'arreglos');
