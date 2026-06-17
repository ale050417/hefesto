ALTER TABLE "products" DROP CONSTRAINT "products_sale_price_lt_price";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "images_one_primary_per_product" ON "product_images" USING btree ("product_id") WHERE "product_images"."is_primary";--> statement-breakpoint
CREATE INDEX "images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_label_unique" ON "product_variants" USING btree ("product_id","label");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sale_price_valid" CHECK ("products"."sale_price" IS NULL OR ("products"."sale_price" > 0 AND "products"."sale_price" < "products"."price"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_print_time_non_negative" CHECK ("products"."print_time_minutes" IS NULL OR "products"."print_time_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_weight_non_negative" CHECK ("products"."weight_grams" IS NULL OR "products"."weight_grams" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_price_override_positive" CHECK ("product_variants"."price_override" IS NULL OR "product_variants"."price_override" > 0);