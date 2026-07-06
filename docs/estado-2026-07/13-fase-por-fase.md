# Documento 13 — Fase por fase vs Cap. 18

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 13 de 15.**
Contraste entre lo planificado (Cap. 18) y lo **realmente** implementado (código).
Docs de fase existentes en `docs/`: FASE-5 … FASE-10 + RELEVAMIENTO-2026-06.

## Estado por fase

| Fase                       | Objetivo (Cap. 18)                                                                                       | Documentado | Real (código)                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------- |
| 0 — Cimientos              | repo, Next+TS, Tailwind, ESLint/Husky, Supabase+Drizzle, CI/CD                                           | Completa    | ✅ Completa                                  |
| 1 — Catálogo público       | tablas, seed, CatalogService, Home/Catálogo/Detalle, SEO                                                 | Completa    | ✅ Completa                                  |
| 2 — Admin catálogo         | layout admin, CRUD productos+imágenes, CRUD categorías                                                   | Completa    | ✅ Completa                                  |
| 3 — Auth                   | Supabase Auth, roles, login/registro/recupero, /admin protegido, RLS inicial                             | Completa    | ✅ Completa                                  |
| 4 — Carrito+Checkout+Pagos | Zustand, pedidos, createOrder transaccional, MP+webhook, RLS orders                                      | Completa    | ✅ Completa                                  |
| 5 — Gestión pedidos+emails | OrdersTable, estados, tracking/cancel/refund, Resend, auditoría                                          | Completa    | ✅ Completa (+ borrado hard nuevo)           |
| 6 — Cuenta cliente         | mis pedidos, perfil+direcciones, wishlist, RLS                                                           | Completa    | ✅ Completa                                  |
| 7 — Inventario             | filamentos, fallas con descuento+alertas                                                                 | Completa    | ✅ Completa                                  |
| 8 — Descuentos             | cupones, DiscountService, validación en checkout                                                         | Completa    | ✅ Completa                                  |
| 9 — Reportes               | ReportService (SQL), dashboard+KPIs, CSV                                                                 | Completa    | ✅ Completa                                  |
| 10 — Endurecimiento        | config, estados carga/vacío/error, imágenes+vitals, SEO, a11y, auditoría seguridad, **Sentry+Analytics** | Completa    | 🟡 **Casi**: todo salvo Sentry/Analytics     |
| 11 — Lanzamiento           | dominio, catálogo real, pruebas prod, backups                                                            | Pendiente   | 🔴 **No empezada** (requiere acción en prod) |

## Detalle de las fases con matices

### Fase 10 — "casi completa"

| Sub-paso (Cap. 18)              | Real                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------- |
| 62 configuración+settings       | ✅ (settings feature)                                                           |
| 63 estados carga/vacío/error    | ✅ (`loading.tsx`, `error.tsx`, `EmptyState`, `HefestoLoader`)                  |
| 64 optimización imágenes+vitals | ✅ (`sharp`, AVIF/WebP, `formats` en next.config)                               |
| 65 SEO completo                 | ✅ (`robots.ts`, `sitemap.ts`, metadata)                                        |
| 66 accesibilidad                | 🟡 Parcial (aria-busy, roles; falta auditoría a11y formal)                      |
| 67 auditoría seguridad          | ✅ (RLS hardening 0032/0035; ver Doc 7 para lo pendiente)                       |
| 68 **Sentry + Analytics**       | 🔴 **No cableado** (observability es stub intencional; `ANALYTICS_ID` sin usar) |

**Conclusión Fase 10:** funcionalmente cerrada salvo el paso 68 (Sentry/Analytics),
que fue **diferido a propósito** (no sumar dependencia hasta el deploy). Es la
única brecha real de la fase.

### Fase 11 — no empezada (esperada)

Los 5 pasos (dominio, catálogo real, pruebas prod, backups, 🚀) dependen de
acciones en producción/infra del usuario. Detalle y priorización en el Doc 15.

## Trabajo REALIZADO más allá del Cap. 18 (features extra)

El proyecto **superó** el alcance documentado en el Cap. 18 (que termina en
reportes/hardening). Se implementaron features que **no figuran como fases**:

| Feature extra                                         | Estado                                  | Nota                  |
| ----------------------------------------------------- | --------------------------------------- | --------------------- |
| **Pedidos a medida** (custom)                         | ✅ construido, hoy **apagado por flag** | Chat + cotización     |
| **Recompensas / puntos** (rewards)                    | ✅ completo                             | 1pt/$100              |
| **Ganancias y socios** (earnings)                     | ✅ completo                             | Profit split          |
| **Cola de producción** (production)                   | ✅ completo                             | Impresoras + trabajos |
| **Venta manual / histórica**                          | ✅ completo                             | Mostrador             |
| **Borrado de pedidos (hard + masivo, transaccional)** | ✅ completo                             | Rediseño reciente     |
| **Importar Excel/CSV de ventas**                      | 🟠 placeholder                          | "En construcción"     |

Esto es bueno (más producto), pero implica que **el Cap. 18 quedó desactualizado**
respecto del alcance real → registrar en Doc 14 y actualizar el libro (Cap. 18)
con estas fases/epics extra.

## Resumen

- **Fases 0–9: completas** y verificables en código.
- **Fase 10: completa salvo Sentry/Analytics** (diferido).
- **Fase 11: no empezada** (infra/prod).
- **Alcance extra** (custom, rewards, earnings, production, venta manual, borrado)
  implementado por fuera del plan → el libro debe absorberlo.

_Fin del Documento 13._
