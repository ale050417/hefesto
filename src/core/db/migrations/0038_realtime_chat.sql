-- 0038: chat en tiempo real (Fase 10 del plan integral).
-- Agrega las tablas de mensajes a la publicación de Supabase Realtime para que
-- los INSERT lleguen por websocket a los suscriptores (el chat del pedido y la
-- bandeja "a medida" se refrescan solos; hay fallback de polling si Realtime
-- no está disponible). Realtime respeta RLS: cada uno ve solo lo que ya podía ver.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "order_messages";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE "custom_messages";
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'publicación supabase_realtime inexistente (¿entorno local?)';
END $$;
