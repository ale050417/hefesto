-- 0037: subcategorías (Fase 6 del plan integral).
-- Un solo nivel: una categoría puede tener padre, pero el padre no puede tener
-- padre a su vez (regla reforzada en el servicio). ON DELETE RESTRICT: no se
-- puede borrar una categoría con hijas (coherente con "no borrar en uso").

ALTER TABLE "categories"
  ADD COLUMN "parent_id" uuid REFERENCES "categories"("id") ON DELETE RESTRICT;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_not_self" CHECK ("parent_id" IS DISTINCT FROM "id");

CREATE INDEX "categories_parent_idx" ON "categories" ("parent_id");
