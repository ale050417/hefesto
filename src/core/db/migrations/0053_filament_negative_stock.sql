-- 0053: el stock de filamento PUEDE ir a NEGATIVO (sobreventa / backorder). Si
-- se vende por la tienda sin stock de un color, queda en negativo; al reponer
-- filamento se compensa el deficit (mantiene el orden de lo vendido). Se elimina
-- el CHECK que forzaba stock_grams >= 0.
ALTER TABLE "filaments" DROP CONSTRAINT IF EXISTS "filaments_stock_non_negative";
