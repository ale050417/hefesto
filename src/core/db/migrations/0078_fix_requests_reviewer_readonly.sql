-- 0078: el "Revisor de tiendas" sigue siendo de SOLO lectura (2026-11-17).
--
-- La 0077 les dio "ver" y "crear" en Arreglos a todos los roles que no son
-- administrador, y eso incluyó a la cuenta de los revisores de App Store /
-- Play, que no tiene que poder cargar nada. Se le deja solo "ver", igual que
-- en el resto de los módulos (ver scripts/crear-revisor-tiendas.mts).

UPDATE "roles"
SET "permissions" = jsonb_set("permissions", '{arreglos}', '["ver"]'::jsonb)
WHERE "name" = 'Revisor de tiendas';
