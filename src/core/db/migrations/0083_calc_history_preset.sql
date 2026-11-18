-- 0083: arreglos de la Calculadora que pidió Agustín (2026-11-18).
--
-- 1. El historial guarda con qué TIPO de producto se cotizó (el nombre, tal
--    cual estaba al guardar), para volver a cotizar rápido algo parecido.
-- 2. Los precios ya guardados se redondean a $100 hacia arriba, igual que los
--    nuevos; lo que suma el redondeo va a la ganancia.
-- 3. Tipo nuevo "Figuras personalizadas con IA", con el mismo margen que
--    "Figuras personalizadas" (Ale lo ajusta en Tipos y márgenes).

ALTER TABLE "calc_history" ADD COLUMN IF NOT EXISTS "preset_name" text;
--> statement-breakpoint
UPDATE "calc_history"
SET "ganancia" = "ganancia" + (ceil("precio_final" / 100) * 100 - "precio_final"),
    "precio_final" = ceil("precio_final" / 100) * 100
WHERE "precio_final" > 0
  AND "precio_final" <> ceil("precio_final" / 100) * 100;
--> statement-breakpoint
INSERT INTO "calc_margin_presets" ("name", "margin_pct", "active", "sort_order")
SELECT 'Figuras personalizadas con IA',
       coalesce(
         (SELECT "margin_pct" FROM "calc_margin_presets"
           WHERE lower("name") = 'figuras personalizadas' LIMIT 1),
         100
       ),
       true,
       coalesce(
         (SELECT "sort_order" FROM "calc_margin_presets"
           WHERE lower("name") = 'figuras personalizadas' LIMIT 1),
         0
       )
WHERE NOT EXISTS (
  SELECT 1 FROM "calc_margin_presets"
  WHERE lower("name") = 'figuras personalizadas con ia'
);
