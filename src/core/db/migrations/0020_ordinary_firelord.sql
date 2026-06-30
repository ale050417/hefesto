ALTER TABLE "products" ADD COLUMN "color_mode" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "colors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_prices" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "layer_height" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "infill_percent" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "production_time" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_infill_range" CHECK ("products"."infill_percent" IS NULL OR ("products"."infill_percent" >= 0 AND "products"."infill_percent" <= 100));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_color_mode_valid" CHECK ("products"."color_mode" IN ('single','multi'));