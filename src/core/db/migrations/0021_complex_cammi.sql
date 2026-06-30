CREATE TABLE "manual_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_date" timestamp with time zone NOT NULL,
	"customer_name" text NOT NULL,
	"detail" text,
	"total" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "order_status" DEFAULT 'delivered' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_sales_total_positive" CHECK ("manual_sales"."total" > 0)
);
--> statement-breakpoint
ALTER TABLE "manual_sales" ADD CONSTRAINT "manual_sales_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_sales_date_idx" ON "manual_sales" USING btree ("sale_date");