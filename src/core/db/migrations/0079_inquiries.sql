-- 0079: sección "Consultas" del panel (2026-11-17, pedido de Ale).
--
-- Atención al cliente carga lo que pide una persona, el operador responde con
-- el precio y de ahí sale armado el mensaje para el cliente; si acepta, se
-- marca confirmada.

CREATE TABLE IF NOT EXISTS "inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "unit_price" numeric(12, 2),
  "bulk_price" numeric(12, 2),
  "bulk_from" integer,
  "dimensions" text,
  "colors" text,
  "delivery_time" text,
  "answer_note" text,
  "message" text,
  "answered_by" uuid,
  "answered_by_name" text,
  "answered_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inquiries_status_valid" CHECK ("status" IN ('pending', 'answered', 'confirmed', 'cancelled')),
  CONSTRAINT "inquiries_quantity_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_answered_by_profiles_id_fk"
    FOREIGN KEY ("answered_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_created_by_profiles_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_status_idx" ON "inquiries" ("status", "created_at");
--> statement-breakpoint
-- Tabla interna del panel: RLS activado y sin políticas => la API pública no
-- puede leerla ni tocarla (la app entra con un rol que saltea RLS).
ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Permisos del módulo nuevo para los roles que ya existen (el operador ve SOLO
-- lo que tiene marcado). "crear" = cargar consultas y confirmarlas (atención
-- al cliente); "editar" = responderlas con el precio (operador). El revisor de
-- las tiendas y cualquier otro rol quedan en solo lectura.
UPDATE "roles"
SET "permissions" = "permissions" || jsonb_build_object(
  'consultas',
  CASE
    WHEN "name" = 'Operador' THEN '["ver", "crear", "editar"]'::jsonb
    WHEN lower("name") LIKE 'atenci%n al cliente' THEN '["ver", "crear"]'::jsonb
    ELSE '["ver"]'::jsonb
  END
)
WHERE "is_admin" = false
  AND NOT jsonb_exists("permissions", 'consultas');
