-- 0044: agregar 'material' al catalogo de filamento (kind) para dar de alta /
-- borrar tipos de material (PLA, PETG...) desde el panel, igual que las marcas.
-- Amplia el CHECK y siembra los materiales base. Aditiva e idempotente.
ALTER TABLE "filament_catalog" DROP CONSTRAINT IF EXISTS "filament_catalog_kind_valid";--> statement-breakpoint
ALTER TABLE "filament_catalog" ADD CONSTRAINT "filament_catalog_kind_valid" CHECK ("kind" IN ('color','brand','material'));--> statement-breakpoint
INSERT INTO "filament_catalog" ("kind","name","hex") VALUES
  ('material','PLA',NULL),
  ('material','PLA mate',NULL),
  ('material','PLA translúcido',NULL),
  ('material','PLA arcoíris',NULL),
  ('material','PETG',NULL),
  ('material','PETG reforzado',NULL),
  ('material','TPU',NULL),
  ('material','TPU + PLA',NULL),
  ('material','Resina',NULL),
  ('material','Resina 8K',NULL),
  ('material','ABS',NULL)
ON CONFLICT ("kind","name") DO NOTHING;
