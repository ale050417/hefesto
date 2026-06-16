ALTER TABLE "products" DROP CONSTRAINT "products_stock_non_negative";--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "variants_stock_non_negative";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "stock";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "stock";