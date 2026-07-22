-- Categorías predeterminadas de impresión 3D para que la tienda no arranque
-- vacía y el carrusel de círculos del home se vea bien. Son un punto de partida:
-- se pueden editar o borrar desde el panel (Catálogo → Categorías).
-- Idempotente: ON CONFLICT DO NOTHING evita duplicar si el nombre o el slug ya
-- existe (ambas columnas son UNIQUE), así es seguro reintentar la migración.
INSERT INTO "categories" (name, slug, icon, color, sort_order) VALUES
  ('Decoración', 'decoracion', 'sparkles', '#C9A84C', 0),
  ('Llaveros', 'llaveros', 'key', '#5A9CD9', 1),
  ('Figuras', 'figuras', 'star', '#9B7BD4', 2),
  ('Hogar y Cocina', 'hogar-y-cocina', 'home', '#4CB782', 3),
  ('Organizadores', 'organizadores', 'box', '#D98A5A', 4),
  ('Gaming', 'gaming', 'gamepad', '#D96A5A', 5),
  ('Iluminación', 'iluminacion', 'lamp', '#D9A441', 6),
  ('Gadgets', 'gadgets', 'cpu', '#5ED29A', 7),
  ('Regalos', 'regalos', 'gift', '#C9A84C', 8)
ON CONFLICT DO NOTHING;
