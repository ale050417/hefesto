-- 0048: cupones con OBJETIVO y cumpleaños (Bloque 7 - Descuentos).
--  - scope: a qué aplica el cupón ('all' = todo el carrito | 'product' | 'category').
--  - target_id / target_label: id del producto/categoría objetivo + su nombre
--    (snapshot para mostrar y para el link, sobrevive si se renombra).
--  - birthday_only: solo vale en la semana del cumpleaños del cliente logueado.
--  - profiles.birth_date: fecha de nacimiento (opcional) para el cupón de cumple.
-- Todo aditivo e idempotente; los cupones existentes quedan scope='all'.
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "target_id" uuid;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "target_label" text;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "birthday_only" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_scope_valid";--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_scope_valid" CHECK ("scope" IN ('all','product','category'));--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "birth_date" date;
