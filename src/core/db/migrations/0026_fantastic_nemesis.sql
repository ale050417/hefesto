CREATE TABLE "store_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text,
	"align" text DEFAULT 'left' NOT NULL,
	"cta_text" text,
	"cta_href" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "slogan" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "season" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "season_deco" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "business_settings" ADD COLUMN "season_intensity" integer DEFAULT 16 NOT NULL;