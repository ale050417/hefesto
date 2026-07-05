-- Cierre de RLS en las 2 tablas que faltaban (tarea "eliminación total" +
-- hardening). La app entra con Drizzle (rol con BYPASSRLS), así que esto NO la
-- afecta: es la red final para la API pública de Supabase (PostgREST + anon
-- key), igual criterio que 0032. Ambas son internas/admin: sin política de
-- lectura ni escritura => la API pública no puede leerlas ni tocarlas.
-- Refuerza la 3.ª capa de permisos del borrado (UI + servidor + RLS).

-- roles: define los permisos del equipo. Solo la app (server) los gestiona.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- calc_margin_presets: presets de margen de la calculadora (uso admin).
ALTER TABLE "calc_margin_presets" ENABLE ROW LEVEL SECURITY;
