ALTER TABLE "products" ADD COLUMN "amortization" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "profit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "manual_sales" ADD COLUMN "amortization" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "manual_sales" ADD COLUMN "profit" numeric(12, 2);