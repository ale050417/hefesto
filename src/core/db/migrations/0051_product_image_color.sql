-- 0051: color opcional en la imagen del producto. Permite que cada color de la
-- variación tenga su(s) foto(s): al elegir un color en la tienda, la galería
-- muestra la imagen etiquetada con ese color. NULL = imagen general (sirve para
-- todos los colores). Aditiva, no rompe nada existente.
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "color" text;
