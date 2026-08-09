-- 0070: modo de negocio (2026-08-08).
--
-- Hasta ahora la tienda siempre vendía online (carrito + checkout + MercadoPago).
-- Ale también quiere poder mostrarla como VIDRIERA DIGITAL: mismo catálogo, mismos
-- precios y variantes, pero sin compra online — cada producto manda a WhatsApp.
--
-- Un solo campo en el singleton de configuración, igual que la temporada:
-- reversible desde Config→Tienda, sin deploy ni migración nueva para cambiarlo.
--
-- DEFAULT 'checkout': la tienda sigue funcionando exactamente igual que hoy
-- hasta que Ale elija "Vidriera digital" a propósito.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS business_mode text NOT NULL DEFAULT 'checkout';

-- Solo estos dos valores tienen sentido; cualquier otra cosa es un bug, no una
-- opción de negocio.
DO $$
BEGIN
  ALTER TABLE business_settings
    ADD CONSTRAINT business_settings_mode_valid
    CHECK (business_mode IN ('checkout', 'vidriera'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
