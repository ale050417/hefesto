CREATE TYPE "public"."print_job_status" AS ENUM('queued', 'printing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."printer_status" AS ENUM('idle', 'printing', 'maintenance', 'offline');--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"model" text,
	"status" "printer_status" DEFAULT 'idle' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_id" uuid,
	"order_id" uuid,
	"title" text NOT NULL,
	"status" "print_job_status" DEFAULT 'queued' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_jobs_printer_idx" ON "print_jobs" USING btree ("printer_id");--> statement-breakpoint
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" USING btree ("status");--> statement-breakpoint
-- RLS: solo el staff (admin/operador) lee impresoras y trabajos.
ALTER TABLE "printers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "printers_staff_read" ON "printers" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);--> statement-breakpoint
ALTER TABLE "print_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "print_jobs_staff_read" ON "print_jobs" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = (select auth.uid()) AND p."role" IN ('admin','operator'))
);
