-- 0046: encuadre de la imagen del producto (Bloque 5 wizard). `position` guarda
-- el object-position CSS (ej. '50% 30%') para acomodar el recorte igual que los
-- sliders del hero. Aditiva, con default centrado. No rompe imagenes existentes.
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "position" text NOT NULL DEFAULT '50% 50%';
