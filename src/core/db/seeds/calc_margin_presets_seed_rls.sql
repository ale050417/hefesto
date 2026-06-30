-- ============================================================================
-- Tipos de producto con margen (calculadora) — seed + RLS
-- Correr UNA VEZ después de `pnpm db:generate && pnpm db:migrate` (que crea la
-- tabla `calc_margin_presets`). Es idempotente: se puede correr más de una vez.
-- Pegalo en el SQL editor de Supabase (o psql).
-- Los % son EJEMPLOS: editalos después desde el panel (Calculadora → Tipos y
-- márgenes). El margen puede superar el 100%.
-- ============================================================================

-- 1) Tipos de ejemplo (orden y margen editables desde el panel).
insert into calc_margin_presets (name, margin_pct, active, sort_order)
values
  ('Llaveros 1 color',  200, true, 1),
  ('Llaveros 2 colores', 230, true, 2),
  ('Llaveros 3 colores', 260, true, 3),
  ('Llaveros 4 colores', 290, true, 4),
  ('Letras',             180, true, 5),
  ('Macetas',            150, true, 6),
  ('Lámparas',           220, true, 7)
on conflict (name) do nothing;

-- 2) RLS sobre `calc_margin_presets`. La app escribe con Drizzle (rol con
--    BYPASSRLS); estas políticas son la red final para la API pública.
--    Staff puede leer; solo admin puede crear/editar/borrar.
alter table calc_margin_presets enable row level security;

drop policy if exists "calc_margin_presets_select_staff" on calc_margin_presets;
create policy "calc_margin_presets_select_staff" on calc_margin_presets
  for select using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role in ('admin','operator')
    )
  );

drop policy if exists "calc_margin_presets_write_admin" on calc_margin_presets;
create policy "calc_margin_presets_write_admin" on calc_margin_presets
  for all using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );
