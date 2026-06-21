CREATE TYPE "public"."custom_request_status" AS ENUM('pending', 'quoted', 'approved', 'in_production', 'done', 'rejected');--> statement-breakpoint
CREATE TABLE "custom_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_staff" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reference_image_url" text,
	"status" "custom_request_status" DEFAULT 'pending' NOT NULL,
	"quoted_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_messages" ADD CONSTRAINT "custom_messages_request_id_custom_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."custom_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_messages" ADD CONSTRAINT "custom_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_messages_request_idx" ON "custom_messages" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "custom_requests_customer_idx" ON "custom_requests" USING btree ("customer_id");--> statement-breakpoint
-- RLS: el cliente ve/gestiona solo sus solicitudes y sus mensajes.
ALTER TABLE "custom_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "custom_requests_own" ON "custom_requests" FOR SELECT USING ((select auth.uid()) = "customer_id");--> statement-breakpoint
ALTER TABLE "custom_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "custom_messages_own" ON "custom_messages" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "custom_requests" r WHERE r."id" = "custom_messages"."request_id" AND r."customer_id" = (select auth.uid()))
);
