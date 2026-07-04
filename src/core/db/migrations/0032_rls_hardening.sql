-- RLS faltante (auditoría 2026-07, hallazgo C1). La app entra con Drizzle (rol
-- con BYPASSRLS); estas políticas son la red final para la API pública de
-- Supabase (PostgREST + anon key). Sin RLS, estas 9 tablas eran legibles Y
-- escribibles por cualquiera con la anon key (que viaja al navegador).
-- Regla: sin política de escritura => la API no puede escribir.

-- Dinero interno: solo admin lee.
ALTER TABLE "manual_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "manual_sales_admin_read" ON "manual_sales" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);--> statement-breakpoint
ALTER TABLE "profit_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profit_shares_admin_read" ON "profit_shares" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);--> statement-breakpoint
ALTER TABLE "cost_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cost_settings_admin_read" ON "cost_settings" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);--> statement-breakpoint
ALTER TABLE "calc_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "calc_history_admin_read" ON "calc_history" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);--> statement-breakpoint

-- Gestión del taller: staff (admin/operador) lee.
ALTER TABLE "manual_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "manual_customers_staff_read" ON "manual_customers" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);--> statement-breakpoint
ALTER TABLE "payment_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payment_settings_staff_read" ON "payment_settings" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);--> statement-breakpoint

-- Contenido de la tienda: lectura pública SOLO de filas activas (el panel lee
-- todo igual, porque la app entra con Drizzle).
ALTER TABLE "store_banners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_banners_public_read" ON "store_banners" FOR SELECT USING ("is_active" = true);--> statement-breakpoint
ALTER TABLE "rewards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "rewards_public_read" ON "rewards" FOR SELECT USING ("is_active" = true);--> statement-breakpoint
ALTER TABLE "shipping_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "shipping_settings_public_read" ON "shipping_settings" FOR SELECT USING (true);
