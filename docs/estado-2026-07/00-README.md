# Estado de Hefesto 3D — Relevamiento 2026-07

Foto completa del estado **real** del proyecto (no es auditoría de bugs; es
registro de estado). Serie de 15 documentos. Método: eficiente con foco en
riesgo (deep-read en dinero/stock/auth/RLS/pagos; el resto por encabezado +
exports + rol arquitectónico). Cadencia: **un documento a la vez, con checkpoint**.

## Índice

| #   | Documento                            | Archivo                                                              | Estado   |
| --- | ------------------------------------ | -------------------------------------------------------------------- | -------- |
| 1   | Inventario por archivo               | [`01-inventario-por-archivo.md`](01-inventario-por-archivo.md)       | ✅ Hecho |
| 2   | Arquitectura y dependencias          | [`02-arquitectura-dependencias.md`](02-arquitectura-dependencias.md) | ✅ Hecho |
| 3   | Esquema de base de datos + RLS       | [`03-esquema-base-datos.md`](03-esquema-base-datos.md)               | ✅ Hecho |
| 4   | Inventario de API/rutas              | [`04-inventario-api-rutas.md`](04-inventario-api-rutas.md)           | ✅ Hecho |
| 5   | Config y variables de entorno        | [`05-config-env.md`](05-config-env.md)                               | ✅ Hecho |
| 6   | Cobertura de tests                   | [`06-cobertura-tests.md`](06-cobertura-tests.md)                     | ✅ Hecho |
| 7   | Checklist de seguridad               | [`07-checklist-seguridad.md`](07-checklist-seguridad.md)             | ✅ Hecho |
| 8   | Integraciones externas               | [`08-integraciones-externas.md`](08-integraciones-externas.md)       | ✅ Hecho |
| 9   | Glosario de reglas de negocio        | [`09-glosario-reglas-negocio.md`](09-glosario-reglas-negocio.md)     | ✅ Hecho |
| 10  | Deuda técnica                        | [`10-deuda-tecnica.md`](10-deuda-tecnica.md)                         | ✅ Hecho |
| 11  | Auditoría de dependencias            | [`11-auditoria-dependencias.md`](11-auditoria-dependencias.md)       | ✅ Hecho |
| 12  | Consistencia visual vs index.html    | [`12-consistencia-visual.md`](12-consistencia-visual.md)             | ✅ Hecho |
| 13  | Fase por fase vs Cap. 18             | [`13-fase-por-fase.md`](13-fase-por-fase.md)                         | ✅ Hecho |
| 14  | Log de desvíos del libro             | [`14-log-desvios.md`](14-log-desvios.md)                             | ✅ Hecho |
| 15  | Síntesis final / camino a producción | [`15-sintesis-final.md`](15-sintesis-final.md)                       | ✅ Hecho |

## Notas de método

- **Espejo truncado:** el shell del sandbox lee algunos archivos cortados a la
  mitad; por eso no se publican conteos de líneas por archivo y los conteos
  agregados van con caveat. Los archivos de riesgo se leyeron con la file-tool
  (fuente confiable).
- **Área en obra:** el borrado de pedidos (orders) fue rediseñado a hard-delete
  transaccional (con reversa de puntos/cupón) + borrado masivo. Documentado como
  estado actual; el desvío respecto del criterio previo va en el Doc 14.
- **Fuente de verdad:** `HEFESTO-Libro-Maestro.md` (raíz del proyecto).
