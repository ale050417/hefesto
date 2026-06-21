CREATE TABLE "order_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_staff" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_messages_order_idx" ON "order_messages" USING btree ("order_id");--> statement-breakpoint
-- RLS: el cliente ve/gestiona solo los mensajes de sus pedidos.
ALTER TABLE "order_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_messages_own" ON "order_messages" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "orders" o WHERE o."id" = "order_messages"."order_id" AND o."customer_id" = (select auth.uid()))
);
