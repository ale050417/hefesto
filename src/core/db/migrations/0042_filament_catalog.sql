-- 0042: catálogo persistente de COLORES y MARCAS de filamento.
-- Antes eran texto libre (be1951b). Ahora el admin los elige de un selector y
-- puede dar de alta nuevos (botón), que quedan guardados y disponibles siempre.
-- Una sola tabla con discriminador `kind` ('color' | 'brand'); los colores
-- guardan su tono (hex) para el punto de color de la UI. Aditiva y segura.
CREATE TABLE IF NOT EXISTS "filament_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "hex" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "filament_catalog_kind_valid" CHECK ("kind" IN ('color','brand')),
  CONSTRAINT "filament_catalog_unique" UNIQUE ("kind","name")
);--> statement-breakpoint
-- Seed de los valores base (idempotente). Colores con su tono.
INSERT INTO "filament_catalog" ("kind","name","hex") VALUES
  ('color','Negro','#1a1a1f'),
  ('color','Blanco','#f4f4f0'),
  ('color','Dorado','#C9A84C'),
  ('color','Gris','#8b8b95'),
  ('color','Rojo','#d14b3c'),
  ('color','Azul','#3a72c4'),
  ('color','Verde','#3fa46a'),
  ('color','Galaxia','#4b3a78'),
  ('color','Translúcido','#cfe6ee'),
  ('color','Arcoíris','#d98a5a'),
  ('brand','Grilon3',NULL),
  ('brand','Print3D',NULL),
  ('brand','3N3',NULL),
  ('brand','eSun',NULL),
  ('brand','Bambu Lab',NULL),
  ('brand','Hellbot',NULL),
  ('brand','Genérico',NULL)
ON CONFLICT ("kind","name") DO NOTHING;
