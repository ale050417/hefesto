-- 0045: categoria en ventas manuales, para que Reportes combine "ventas por
-- categoria" de tienda + manuales (Bloque 4). Texto libre (snapshot del nombre
-- de categoria elegido al cargar la venta): sobrevive al borrado de la categoria
-- y no fuerza FK sobre un registro historico. Nullable y aditiva.
ALTER TABLE "manual_sales" ADD COLUMN IF NOT EXISTS "category" text;
