-- Ledger de movimientos de filamento: las ventas (online y manuales) pasan a
-- descontar stock, y cada descuento/reposición queda registrado con el delta
-- REAL aplicado (negativo = consumo). El par (reason, ref_id) da idempotencia
-- a los hooks (un pedido no descuenta dos veces) y el ledger reemplaza el
-- consumo "estimado" del reporte F5 por datos reales.
-- Idempotente (IF NOT EXISTS) por la lección de 0032/0034.
CREATE TABLE IF NOT EXISTS "filament_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filament_id" uuid,
	"material" text NOT NULL,
	"color" text NOT NULL,
	"delta_grams" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_movements_reason_valid" CHECK ("reason" IN ('order','manual_sale','failure','adjust','restore'))
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "filament_movements" ADD CONSTRAINT "filament_movements_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "filament_movements_ref_idx" ON "filament_movements" USING btree ("reason","ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "filament_movements_filament_idx" ON "filament_movements" USING btree ("filament_id");--> statement-breakpoint
-- RLS: tabla interna (la app escribe con Drizzle, rol con BYPASSRLS). Sin
-- políticas => la API pública de Supabase no puede leerla ni tocarla (mismo
-- criterio que 0032/0035).
ALTER TABLE "filament_movements" ENABLE ROW LEVEL SECURITY;
