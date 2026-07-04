-- ============================================================================
-- RESET DE DATOS — Hefesto 3D
-- Vacía TODO el contenido y la configuración para cargar los datos reales.
-- CONSERVA: tu(s) cuenta(s) (tabla `profiles`) y los `roles` del sistema, para
-- que no quedes afuera del panel.
-- NO toca `auth.users` ni los archivos del Storage (imágenes subidas).
--
-- ⚠️ IRREVERSIBLE. Hacé un backup antes si tenés algo que quieras guardar
--    (Supabase → Database → Backups, o un dump). Pegalo en el SQL editor de
--    Supabase y ejecutá.
-- ============================================================================

TRUNCATE TABLE
  -- Catálogo
  products,
  product_images,
  product_variants,
  product_tags,
  tags,
  categories,
  -- Ventas / pedidos
  orders,
  order_items,
  order_status_history,
  order_messages,
  manual_sales,
  -- Clientes y su actividad
  manual_customers,
  addresses,
  wishlist_items,
  reviews,
  notifications,
  point_transactions,
  -- A medida
  custom_requests,
  custom_messages,
  -- Inventario / producción
  filaments,
  print_failures,
  printers,
  print_jobs,
  -- Descuentos y recompensas
  coupons,
  coupon_redemptions,
  rewards,
  -- Ganancias / calculadora
  profit_shares,
  cost_settings,
  calc_history,
  calc_margin_presets,
  -- Apariencia / configuración de la tienda
  business_settings,
  payment_settings,
  shipping_settings,
  store_banners,
  -- Auditoría
  audit_log
RESTART IDENTITY CASCADE;

-- ============================================================================
-- IMÁGENES (Storage) — todo se guarda en el bucket `products`
-- (productos, banners, logo/hero y fotos del chat). Esto borra los registros
-- del Storage. Recomendado además: Supabase → Storage → bucket `products` →
-- seleccionar todo → Eliminar (así se liberan los archivos físicos).
-- ============================================================================
delete from storage.objects where bucket_id = 'products';

-- ============================================================================
-- OPCIONAL — borrar los perfiles de CLIENTES de prueba, conservando el staff
-- (todos los admin/operador, incl. tu cuenta). `profiles` no guarda el email
-- (está en auth.users), así que filtramos por rol. Descomentá para usarlo.
-- No toca auth.users; esos usuarios sueltos no molestan.
-- ============================================================================
-- delete from profiles where role = 'customer';
