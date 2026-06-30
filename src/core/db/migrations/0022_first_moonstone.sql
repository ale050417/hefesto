ALTER TABLE "custom_messages" ALTER COLUMN "body" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "custom_messages" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "custom_requests" ADD COLUMN "budget" numeric(12, 2);