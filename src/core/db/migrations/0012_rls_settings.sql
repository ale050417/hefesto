-- RLS de configuración de marca (Cap. 10/13). La app escribe con Drizzle
-- (rol postgres, BYPASSRLS); estas políticas son la red final para la API
-- pública de Supabase. Regla: logo/hero son públicos (se muestran en el
-- storefront) → lectura pública; nadie escribe por la API pública.

ALTER TABLE "business_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "business_settings_public_read" ON "business_settings" FOR SELECT USING (true);
