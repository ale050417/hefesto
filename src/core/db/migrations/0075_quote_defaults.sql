-- 0075: textos por defecto de la cotización por WhatsApp (2026-10-21).
--
-- El botón "Cotización" (al lado del comprobante y en el producto) arma el
-- mensaje con el formato que usa Antonella. El encabezado, el porcentaje y
-- el texto de la seña y las aclaraciones se guardan acá para que no haya que
-- escribirlos de cero; NULL = usa los textos del código.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS quote_defaults jsonb;
