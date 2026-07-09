-- 0035: timeouts a nivel de rol (anti-cuelgue, DIAGNOSTICO-CUELGUES-2026-07-09 RC1.3)
--
-- ¿Por qué a nivel de ROL y no de sesión? La app se conecta vía el pooler de
-- Supabase en modo transacción, donde los SET de sesión no sobreviven entre
-- transacciones. El setting de rol se aplica al abrir cada conexión, funcione
-- o no el pooler.
--
-- statement_timeout: ninguna query puede colgarse indefinidamente (30 s es
--   holgado para cualquier query legítima de la app; una migración pesada que
--   necesite más puede usar SET LOCAL statement_timeout = 0 dentro de su tx).
-- idle_in_transaction_session_timeout: mata transacciones abandonadas (si un
--   proceso muere a mitad de una tx, la conexión no queda tomada para siempre
--   y el pool no se agota).

DO $$
BEGIN
  EXECUTE format('ALTER ROLE %I SET statement_timeout = %L', current_user, '30s');
  EXECUTE format(
    'ALTER ROLE %I SET idle_in_transaction_session_timeout = %L',
    current_user,
    '30s'
  );
END $$;
