CREATE TYPE "public"."reward_type" AS ENUM('shipping', 'discount', 'product');--> statement-breakpoint
CREATE TABLE "calc_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"customer" text,
	"material" text,
	"color" text,
	"grams" numeric(10, 2) DEFAULT '0' NOT NULL,
	"hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"cost_per_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"margin_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"costo_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ganancia" numeric(12, 2) DEFAULT '0' NOT NULL,
	"precio_final" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"kwh_price" numeric(12, 2) DEFAULT '95' NOT NULL,
	"machine_watts" integer DEFAULT 220 NOT NULL,
	"machine_life_hours" integer DEFAULT 8000 NOT NULL,
	"maintenance_cost" numeric(12, 2) DEFAULT '320000' NOT NULL,
	"margin_error_pct" numeric(5, 2) DEFAULT '8' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_settings_singleton" CHECK ("cost_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "reward_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cost_points" integer NOT NULL,
	"discount_value" numeric(12, 2),
	"discount_is_percent" boolean DEFAULT false NOT NULL,
	"product_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_cost_positive" CHECK ("rewards"."cost_points" > 0)
);
--> statement-breakpoint
CREATE TABLE "profit_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profit_shares_pct_range" CHECK ("profit_shares"."pct" >= 0 AND "profit_shares"."pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "calc_history" ADD CONSTRAINT "calc_history_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calc_history_created_idx" ON "calc_history" USING btree ("created_at");