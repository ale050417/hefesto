CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_tx_customer_idx" ON "point_transactions" USING btree ("customer_id");--> statement-breakpoint
-- RLS: cada cliente ve solo sus movimientos de puntos.
ALTER TABLE "point_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "point_tx_own" ON "point_transactions" FOR SELECT USING ((select auth.uid()) = "customer_id");
