-- RLS inicial (Cap. 10). La app entra con Drizzle (rol postgres, BYPASSRLS),
-- así que estas políticas protegen el acceso por la API pública de Supabase.

-- Catálogo: lectura pública (productos solo si están publicados).
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "products_public_read" ON "products" FOR SELECT USING ("status" = 'published');--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "categories_public_read" ON "categories" FOR SELECT USING (true);--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_images_public_read" ON "product_images" FOR SELECT USING (true);--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_variants_public_read" ON "product_variants" FOR SELECT USING (true);--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tags_public_read" ON "tags" FOR SELECT USING (true);--> statement-breakpoint
ALTER TABLE "product_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_tags_public_read" ON "product_tags" FOR SELECT USING (true);--> statement-breakpoint
-- Perfil: cada usuario solo ve el suyo.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT USING ((select auth.uid()) = "id");
