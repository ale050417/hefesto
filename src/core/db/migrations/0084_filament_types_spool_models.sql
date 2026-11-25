-- 0084: tipos de filamento con precio y modelos de carrete vacío (pedidos de
-- Agustín, 2026-11-24).
--
-- 1. "filament_types": el precio por kg se carga UNA vez por tipo (PLA, PETG,
--    PLA Silk…) y cada carrete elige su tipo. Si sube el precio, se cambia en
--    un solo lugar y no en los 50 carretes. `filaments.cost_per_kg` se sigue
--    guardando (lo leen ventas, costos y reportes): al cambiar el precio de un
--    tipo se actualizan sus carretes.
-- 2. "spool_models": cuánto pesa VACÍO cada modelo de carrete, para sacar el
--    filamento que queda pesando el carrete en uso (peso total − vacío).
--
-- Siembra: un tipo por material con el precio que más se repite, más
-- "PLA Silk (Dorado)" para los dorados. Solo se asigna el tipo a los carretes
-- que YA tienen ese precio: a ninguno se le cambia el costo acá. Los que
-- tienen otro precio quedan "sin tipo" hasta que alguien les elija uno.

CREATE TABLE IF NOT EXISTS "filament_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "cost_per_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "filament_types_name_unique" UNIQUE ("name"),
  CONSTRAINT "filament_types_cost_non_negative" CHECK ("cost_per_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spool_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "empty_grams" numeric(10, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "spool_models_name_unique" UNIQUE ("name"),
  CONSTRAINT "spool_models_empty_non_negative" CHECK ("empty_grams" >= 0)
);
--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN IF NOT EXISTS "type_id" uuid;
--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN IF NOT EXISTS "spool_model_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "filaments" ADD CONSTRAINT "filaments_type_id_filament_types_id_fk"
    FOREIGN KEY ("type_id") REFERENCES "public"."filament_types"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "filaments" ADD CONSTRAINT "filaments_spool_model_id_spool_models_id_fk"
    FOREIGN KEY ("spool_model_id") REFERENCES "public"."spool_models"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "filaments_type_idx" ON "filaments" ("type_id");
--> statement-breakpoint
-- Tablas internas del panel: RLS activado y sin políticas (la API pública no
-- las ve; la app entra con un rol que saltea RLS).
ALTER TABLE "filament_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "spool_models" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Un tipo por material, con el precio más repetido entre sus carretes.
INSERT INTO "filament_types" ("name", "cost_per_kg", "sort_order")
SELECT m."material", m."cost_per_kg", (row_number() OVER (ORDER BY m."material"))::int - 1
FROM (
  SELECT DISTINCT ON (g."material") g."material", g."cost_per_kg"
  FROM (
    SELECT "material", "cost_per_kg", count(*) AS n
    FROM "filaments" GROUP BY "material", "cost_per_kg"
  ) g
  ORDER BY g."material", g.n DESC, g."cost_per_kg" DESC
) m
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
-- Los dorados (PLA Silk) valen distinto que el PLA común: tipo aparte.
INSERT INTO "filament_types" ("name", "cost_per_kg", "sort_order")
SELECT 'PLA Silk (Dorado)', max(f."cost_per_kg"), 100
FROM "filaments" f
WHERE f."material" = 'PLA' AND lower(f."color") LIKE 'dorado%'
  AND f."cost_per_kg" <> (SELECT t."cost_per_kg" FROM "filament_types" t WHERE t."name" = 'PLA')
HAVING count(*) > 0
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
UPDATE "filaments" f SET "type_id" = t."id"
FROM "filament_types" t
WHERE f."type_id" IS NULL AND t."name" = 'PLA Silk (Dorado)'
  AND f."material" = 'PLA' AND lower(f."color") LIKE 'dorado%'
  AND f."cost_per_kg" = t."cost_per_kg";
--> statement-breakpoint
UPDATE "filaments" f SET "type_id" = t."id"
FROM "filament_types" t
WHERE f."type_id" IS NULL AND t."name" = f."material"
  AND f."cost_per_kg" = t."cost_per_kg";
