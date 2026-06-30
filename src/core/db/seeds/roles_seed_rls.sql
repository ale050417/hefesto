-- ============================================================================
-- Paso A — Roles personalizados: seed + backfill + RLS
-- Correr UNA VEZ después de `pnpm db:generate && pnpm db:migrate` (que crea la
-- tabla `roles` y las columnas `profiles.role_id` / `profiles.must_change_password`).
-- Es idempotente: se puede correr más de una vez sin romper nada.
-- Pegalo en el SQL editor de Supabase (o psql).
-- ============================================================================

-- 1) Roles de sistema (no se pueden borrar desde el panel).
--    Administrador = acceso total (is_admin ignora permissions).
--    Operador = gestión operativa, sin administrar equipo/roles.
insert into roles (name, permissions, is_system, is_admin)
values
  ('Administrador', '{}'::jsonb, true, true),
  ('Operador',
   '{"productos":["ver","crear","editar","eliminar"],
     "pedidos":["ver","crear","editar","eliminar"],
     "clientes":["ver","crear","editar","eliminar"],
     "descuentos":["ver","crear","editar","eliminar"],
     "reportes":["ver"],
     "config":["ver","editar"]}'::jsonb,
   true, false)
on conflict (name) do nothing;

-- 2) Backfill: asignar role_id al staff actual según su enum `role`.
update profiles p
set role_id = r.id
from roles r
where r.name = 'Administrador' and p.role = 'admin' and p.role_id is null;

update profiles p
set role_id = r.id
from roles r
where r.name = 'Operador' and p.role = 'operator' and p.role_id is null;

-- 3) RLS sobre `roles`. La app escribe con Drizzle (rol con BYPASSRLS); estas
--    políticas son la red final para la API pública de Supabase.
--    Staff puede leer; solo admin puede crear/editar/borrar.
alter table roles enable row level security;

drop policy if exists "roles_select_staff" on roles;
create policy "roles_select_staff" on roles
  for select using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role in ('admin','operator')
    )
  );

drop policy if exists "roles_write_admin" on roles;
create policy "roles_write_admin" on roles
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
