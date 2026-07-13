-- 0049: pedidos "a medida" SIN login (lead de invitado). El cliente puede pedir
-- sin cuenta: customer_id pasa a NULLABLE y se agregan datos de contacto del
-- invitado (nombre + WhatsApp + email opcional). La conversación sigue por
-- WhatsApp; el panel guarda el lead para gestionarlo. Aditiva.
ALTER TABLE "custom_requests" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_requests" ADD COLUMN IF NOT EXISTS "guest_name" text;--> statement-breakpoint
ALTER TABLE "custom_requests" ADD COLUMN IF NOT EXISTS "guest_phone" text;--> statement-breakpoint
ALTER TABLE "custom_requests" ADD COLUMN IF NOT EXISTS "guest_email" text;
