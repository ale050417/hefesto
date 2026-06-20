CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text,
	"full_name" text,
	"phone" text,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"postal_code" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_id_profiles_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_customer_product_unique" ON "wishlist_items" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE INDEX "wishlist_customer_idx" ON "wishlist_items" USING btree ("customer_id");--> statement-breakpoint
-- RLS: cada cliente ve/gestiona SOLO lo suyo (red final de la API pública).
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "addresses_own" ON "addresses" USING ((select auth.uid()) = "customer_id") WITH CHECK ((select auth.uid()) = "customer_id");--> statement-breakpoint
ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "wishlist_own" ON "wishlist_items" USING ((select auth.uid()) = "customer_id") WITH CHECK ((select auth.uid()) = "customer_id");--> statement-breakpoint
-- El cliente puede actualizar su propio perfil.
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE USING ((select auth.uid()) = "id") WITH CHECK ((select auth.uid()) = "id");
