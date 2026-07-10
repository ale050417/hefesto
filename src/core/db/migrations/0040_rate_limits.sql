-- Rate limiting distribuido (cierra la deuda del Cap. 4 / auditoría 2026-07):
-- un contador por clave con ventana fija. El limiter en memoria contaba POR
-- PROCESO: en serverless cada instancia tenía su propio contador y el límite
-- real se multiplicaba. Ahora el contador vive acá y el upsert atómico
-- (INSERT ... ON CONFLICT, en core/security/rate-limit.ts) decide reinicio o
-- incremento en una sola sentencia, sin carreras. Sin dependencias nuevas.
-- Idempotente (IF NOT EXISTS), como 0032/0034/0039.
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
-- RLS: tabla interna (solo la app por Drizzle). Sin políticas => la API
-- pública de Supabase no puede leerla ni tocarla (mismo criterio que 0032).
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
