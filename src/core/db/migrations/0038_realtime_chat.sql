-- 0038: chat en tiempo real (Fase 10 del plan integral).
-- Agrega las tablas de mensajes a la publicación de Supabase Realtime para que
-- los INSERT lleguen por websocket a los suscriptores. Realtime respeta RLS.
--
-- NOTA permisos: en Supabase la publicación `supabase_realtime` pertenece a
-- `supabase_admin`; el rol `postgres` de las migraciones puede no tener permiso
-- para alterarla. Si es el caso, este bloque NO falla: avisa con NOTICE y las
-- tablas se agregan a mano en el Dashboard (Database → Publications →
-- supabase_realtime → agregar `order_messages` y `custom_messages`).
-- El chat funciona igual sin esto (fallback de polling cada 30 s).

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "order_messages";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá order_messages desde el Dashboard';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "custom_messages";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'sin permiso sobre supabase_realtime: agregá custom_messages desde el Dashboard';
END $$;
