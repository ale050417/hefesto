CREATE TABLE "filaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material" text NOT NULL,
	"color" text NOT NULL,
	"stock_grams" numeric(10, 2) DEFAULT '0' NOT NULL,
	"alert_threshold_grams" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filaments_stock_non_negative" CHECK ("filaments"."stock_grams" >= 0),
	CONSTRAINT "filaments_threshold_non_negative" CHECK ("filaments"."alert_threshold_grams" >= 0)
);
--> statement-breakpoint
CREATE TABLE "print_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filament_id" uuid,
	"piece_name" text NOT NULL,
	"material" text,
	"color" text,
	"grams_lost" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"deducted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_failures_grams_positive" CHECK ("print_failures"."grams_lost" > 0)
);
--> statement-breakpoint
ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_failures_filament_idx" ON "print_failures" USING btree ("filament_id");--> statement-breakpoint
-- RLS: inventario solo para staff (admin/operador). Escritura por el server.
ALTER TABLE "filaments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "filaments_staff_read" ON "filaments" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);--> statement-breakpoint
ALTER TABLE "print_failures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "print_failures_staff_read" ON "print_failures" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);
