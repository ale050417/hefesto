-- 0081: "Pendientes del equipo" en Pedidos (2026-11-17, pedido de Agustín).
--
-- Lista compartida entre los que usan el panel (operador, atención al cliente,
-- dueño): cualquiera anota un pendiente (un pedido que falta cargar, una
-- cotización por mandar, un caso olvidado) y cualquiera lo tilda. Los nombres
-- se guardan como texto para que el pendiente se entienda aunque la cuenta se
-- borre.

CREATE TABLE IF NOT EXISTS "team_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "body" text NOT NULL,
  "done" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "created_by_name" text,
  "done_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "done_at" timestamp with time zone,
  CONSTRAINT "team_tasks_body_length" CHECK (char_length("body") BETWEEN 1 AND 500)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_tasks_done_idx" ON "team_tasks" ("done", "created_at");
--> statement-breakpoint
-- Tabla interna del panel: RLS activado y sin políticas => la API pública
-- (anon / authenticated) no puede leerla ni tocarla. La app entra con un rol
-- que saltea RLS. No hace falta tocar "roles": los pendientes usan los permisos
-- del módulo Pedidos, que ya existe.
ALTER TABLE "team_tasks" ENABLE ROW LEVEL SECURITY;
