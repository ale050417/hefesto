-- Idempotencia REAL de los puntos por pedido (auditoría 2026-07, hallazgo I3).
-- awardForOrder se llama desde el webhook de MP y desde la confirmación manual;
-- su chequeo "¿ya se otorgó?" es leer-luego-escribir y bajo concurrencia podía
-- duplicar puntos.

-- 0) Limpieza previa: si la carrera YA duplicó acreditaciones históricas, el
--    índice único no se podría crear. Borramos los duplicados conservando la
--    acreditación MÁS VIEJA de cada pedido (la original). El saldo del cliente
--    se calcula sumando `delta`, así que esto corrige saldos inflados por el
--    bug — es la corrección correcta, no una pérdida de datos.
DELETE FROM "point_transactions" a
USING "point_transactions" b
WHERE a."order_id" IS NOT NULL
  AND a."delta" > 0
  AND b."order_id" = a."order_id"
  AND b."delta" > 0
  AND a."id" <> b."id"
  AND (b."created_at" < a."created_at"
       OR (b."created_at" = a."created_at" AND b."id" < a."id"));--> statement-breakpoint

-- 1) El índice único parcial: a lo sumo UNA acreditación positiva por pedido.
CREATE UNIQUE INDEX IF NOT EXISTS "point_transactions_order_award_unique"
  ON "point_transactions" ("order_id")
  WHERE "order_id" IS NOT NULL AND "delta" > 0;
