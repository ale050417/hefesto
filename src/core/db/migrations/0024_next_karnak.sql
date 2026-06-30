ALTER TABLE "filaments" ADD COLUMN "brand" text DEFAULT 'Genérico' NOT NULL;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "diameter" text DEFAULT '1.75' NOT NULL;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "spool_grams" numeric(10, 2) DEFAULT '1000' NOT NULL;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "cost_per_kg" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "filaments" ADD CONSTRAINT "filaments_spool_positive" CHECK ("filaments"."spool_grams" > 0);--> statement-breakpoint
ALTER TABLE "filaments" ADD CONSTRAINT "filaments_cost_non_negative" CHECK ("filaments"."cost_per_kg" >= 0);