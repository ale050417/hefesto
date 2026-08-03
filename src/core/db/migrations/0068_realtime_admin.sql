-- 0068: panel admin en TIEMPO REAL (2026-07-29).
-- Publica en `supabase_realtime` las tablas que mueven el panel, para que un
-- cambio hecho por un empleado le llegue al dueño sin recargar la página.
--
-- Mismo criterio que 0038 (chat): si el rol de las migraciones no es dueño de
-- la publicación (en Supabase pertenece a `supabase_admin`), el bloque NO
-- falla: deja un NOTICE y las tablas se agregan a mano desde el Dashboard
-- (Database → Publications → supabase_realtime).
-- El panel funciona igual sin esto: AdminLiveRefresh refresca cada 45 s de
-- respaldo.
--
-- A PROPÓSITO quedan AFUERA `profiles` y `point_transactions`: son datos
-- personales de clientes y no hace falta transmitirlos por websocket. Esas
-- pantallas se actualizan por el respaldo de 45 s.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "orders";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá orders desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "order_items";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá order_items desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "order_status_history";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá order_status_history desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "manual_sales";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá manual_sales desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "products";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá products desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "product_variants";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá product_variants desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "product_images";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá product_images desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "categories";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá categories desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "filaments";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá filaments desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "filament_movements";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá filament_movements desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "print_failures";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá print_failures desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "print_jobs";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá print_jobs desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "reviews";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá reviews desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "custom_requests";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá custom_requests desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "coupons";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá coupons desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "rewards";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá rewards desde el Dashboard';
END $$;
