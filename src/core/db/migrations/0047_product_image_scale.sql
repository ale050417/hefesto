-- 0047: zoom de la imagen del producto (alejar/acercar). `scale` = factor de
-- transform (1 = normal, >1 acerca/recorta, <1 aleja mostrando el fondo de la
-- card). Junto con `position` (0046) da encuadre completo. Aditiva, default 1.
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "scale" numeric(4,2) NOT NULL DEFAULT 1;
