-- 0043: backfill del ledger para las fallas ya descontadas.
-- Desde ahora las fallas descuentan Y se reponen por el ledger de filamento
-- (reason='failure'), igual que las ventas (multicolor). Para que el BORRADO de
-- una falla vieja tambien devuelva stock por ese mismo camino, registramos un
-- movimiento por cada falla ya descontada. NO toca stock (esas fallas ya
-- restaron su gramaje por la tabla print_failures); solo deja la traza en el
-- ledger. Idempotente: no duplica si ya existe el movimiento de esa falla.
INSERT INTO "filament_movements" ("filament_id","material","color","delta_grams","reason","ref_id","created_at")
SELECT pf."filament_id",
       COALESCE(pf."material", ''),
       COALESCE(pf."color", ''),
       (-1 * pf."grams_lost")::numeric(10,2),
       'failure',
       pf."id",
       pf."created_at"
FROM "print_failures" pf
WHERE pf."deducted" = true
  AND pf."filament_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "filament_movements" m
    WHERE m."reason" = 'failure' AND m."ref_id" = pf."id"
  );
