-- Idempotencia REAL de los puntos por pedido (auditoría 2026-07, hallazgo I3).
-- awardForOrder se llama desde el webhook de MP y desde la confirmación manual;
-- su chequeo "¿ya se otorgó?" es leer-luego-escribir y bajo concurrencia podía
-- duplicar puntos. Este índice único parcial lo hace imposible a nivel base:
-- a lo sumo UNA acreditación positiva por pedido.
CREATE UNIQUE INDEX IF NOT EXISTS "point_transactions_order_award_unique"
  ON "point_transactions" ("order_id")
  WHERE "order_id" IS NOT NULL AND "delta" > 0;
