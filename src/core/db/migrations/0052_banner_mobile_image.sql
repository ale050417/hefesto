-- 0052: imagen de banner SEPARADA para celular. En desktop se usa image_url
-- (banner ancho); en móvil, si hay mobile_image_url, se usa esa (vertical o
-- cuadrada, con más impacto). NULL = usar la de desktop en todos lados. Aditiva.
ALTER TABLE "store_banners" ADD COLUMN IF NOT EXISTS "mobile_image_url" text;
