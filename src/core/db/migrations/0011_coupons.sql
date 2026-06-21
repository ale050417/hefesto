CREATE TYPE "public"."coupon_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "coupon_type" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"min_purchase" numeric(12, 2) DEFAULT '0' NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_value_positive" CHECK ("coupons"."value" > 0),
	CONSTRAINT "coupons_min_purchase_non_negative" CHECK ("coupons"."min_purchase" >= 0),
	CONSTRAINT "coupons_used_count_non_negative" CHECK ("coupons"."used_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- RLS: cupones y canjes solo para admin (los códigos no son públicos).
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "coupons_admin_read" ON "coupons" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "coupon_redemptions_admin_read" ON "coupon_redemptions" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" = 'admin')
);
