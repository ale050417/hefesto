-- Bloque C (2026-07): la venta manual guarda qué filamento consume, para
-- descontar stock al CONFIRMAR (antes se descontaba al crear y no se persistía).
-- Idempotente (ADD COLUMN IF NOT EXISTS + FK protegida) para poder reintentar.
ALTER TABLE "manual_sales" ADD COLUMN IF NOT EXISTS "filament_id" uuid;
ALTER TABLE "manual_sales" ADD COLUMN IF NOT EXISTS "grams" numeric(10, 2);
ALTER TABLE "manual_sales" ADD COLUMN IF NOT EXISTS "color_lines" jsonb;

DO $$ BEGIN
  ALTER TABLE "manual_sales"
    ADD CONSTRAINT "manual_sales_filament_id_filaments_id_fk"
    FOREIGN KEY ("filament_id") REFERENCES "filaments"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
