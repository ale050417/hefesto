CREATE TABLE "payment_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"transfer_enabled" boolean DEFAULT true NOT NULL,
	"transfer_alias" text,
	"transfer_cbu" text,
	"mp_enabled" boolean DEFAULT true NOT NULL,
	"mp_note" text,
	"cash_enabled" boolean DEFAULT true NOT NULL,
	"cash_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_settings_singleton" CHECK ("payment_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "shipping_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"city" text,
	"free_over" numeric(12, 2) DEFAULT '0' NOT NULL,
	"out_msg" text,
	"zones" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_settings_singleton" CHECK ("shipping_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "cuit" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "hours" jsonb;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "pickup_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "delivery_enabled" boolean DEFAULT true NOT NULL;