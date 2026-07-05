-- Cantidad de unidades en la venta manual (fix auditoría 2026-07, bug 2:
-- "cargar 80 unidades una por una"). Default 1: las ventas existentes quedan
-- como una unidad (su total ya era el de la venta completa).
ALTER TABLE "manual_sales"
  ADD COLUMN "quantity" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "manual_sales"
  ADD CONSTRAINT "manual_sales_quantity_positive" CHECK ("quantity" > 0);
