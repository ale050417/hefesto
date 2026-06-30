CREATE TABLE "calc_margin_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"margin_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calc_margin_presets_name_unique" UNIQUE("name"),
	CONSTRAINT "calc_margin_presets_pct_nonneg" CHECK ("calc_margin_presets"."margin_pct" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manual_sales" ADD COLUMN "profit_split" jsonb;