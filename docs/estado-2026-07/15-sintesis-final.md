# Documento 15 — Síntesis final y camino a producción

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 15 de 15.**

## Estado general

Hefesto 3D está **funcionalmente completo como MVP y bastante más**: fases 0–9
del Cap. 18 cerradas, fase 10 (endurecimiento) completa salvo Sentry/Analytics, y
**features extra** por fuera del plan (a medida, recompensas, ganancias/socios,
producción, venta manual, borrado de pedidos transaccional). La arquitectura por
capas (Cap. 5/19) se respeta dentro de cada feature; la lógica de dinero/stock
vive en módulos puros **testeados**. Lo que falta es sobre todo **fase 11
(lanzamiento)** e infraestructura/robustez de producción.

**Semáforo global:** 🟢 producto · 🟡 robustez/infra · 🔴 lanzamiento (no iniciado).

## Bloqueadores para producción (priorizados por impacto)

### 🔴 P0 — imprescindibles antes de abrir

1. **Base de datos de prod lista**: confirmar que **todas las migraciones
   (hasta 0035) estén aplicadas** en Supabase (0034 venta manual, 0035 delete
   hardening). Verificar que las **RLS policies** sean correctas, no solo
   presentes (Doc 3/7).
2. **Backups**: activar backups automáticos de Supabase + **probar un restore**
   (un backup sin restore probado no es un backup). Fase 11.
3. **Entorno de prod completo** (Doc 5): `NEXT_PUBLIC_SITE_URL` (dominio real),
   `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_*`,
   claves Supabase.
4. **Webhook MP en prod + reconciliación de pagos**: registrar la URL del webhook
   con el secret y agregar un fallback para pedidos que quedan en
   `pending_payment` pese a pago aprobado (Doc 8).

### 🟡 P1 — muy recomendables para abrir con red

5. **Rate limit distribuido** (Upstash/Supabase) + cubrir **checkout** y
   formularios públicos (hoy en memoria, ineficaz en serverless). (Doc 7)
6. **Test de integración del borrado de pedidos** (reversa puntos/cupón contra DB
   de prueba) — es código nuevo que toca plata y hoy solo se testea con mocks.
   Sumar una suite de integración mínima. (Doc 6)
7. **Catálogo real**: reemplazar seed/demo y quitar `picsum.photos` de
   `next.config`. (Fase 11)
8. **QA visual vs `index.html`** (Doc 12) + pase de **accesibilidad** (Doc 13).

### 🟢 P2 — deuda de calidad

9. **Sentry + Analytics** (cablear el stub de observability; `ANALYTICS_ID`).
10. **CSP** con nonce (Doc 7).
11. **Romper acoplamientos**: exponer `inventory` vía servicio; cortar ciclos
    products↔wishlist y orders→rewards→reports (Doc 2/14).
12. **Zod en `production/actions`**; limpiar cosméticos (Doc 10/14).

## Recomendaciones profesionales extra (no están en el libro, valen la pena)

1. **Entorno de staging** espejo de prod (Vercel preview + branch de Supabase)
   para probar migraciones y pagos sin tocar producción.
2. **CI con gates**: `tsc --noEmit` + `lint` + `vitest` + `playwright` en cada PR
   (el proyecto ya tiene husky/lint-staged local; llevarlo a GitHub Actions y
   **bloquear merge** si falla).
3. **Reconciliación de pagos programada** (cron) además del webhook, como red.
4. **Monitoreo/uptime** (health check ya existe en `/api/health`): conectar un
   pinger (BetterStack/UptimeRobot) + alertas.
5. **Pool de conexiones**: usar el pooler de Supabase (pgBouncer) para serverless
   y evitar agotar conexiones de Postgres.
6. **Renovate/Dependabot** para mantener al día Next/React/Tailwind (majors
   recientes) con PRs automáticos + audit.
7. **Política de datos personales** (clientes, direcciones, emails): retención,
   export/borrado a pedido, y revisar que la auditoría no loguee datos sensibles.
8. **Feature flags formalizados**: hoy `CUSTOM_ORDERS_ENABLED` es una constante;
   si aparecen más flags, centralizarlos (un módulo `core/flags`).
9. **Runbook de incidentes** de pago (qué hacer si el webhook falla, cómo
   reprocesar) y de restore de backup.
10. **Observabilidad de negocio**: además de errores, loguear eventos clave
    (pedido creado/pagado/cancelado, cupón usado) para reportes y debugging.

## Camino a producción (orden sugerido)

```
1. Staging (Vercel preview + Supabase branch)         [P0/infra]
2. Migraciones aplicadas + RLS revisadas + backups    [P0]
3. Env de prod completo + webhook MP + reconciliación [P0]
4. Rate limit distribuido + checkout                  [P1]
5. Test integración borrado + suite mínima            [P1]
6. Catálogo real + QA visual + a11y                   [P1]
7. Sentry/Analytics + CSP + limpieza de acoplamientos [P2]
8. CI gates + monitoreo/uptime + runbook              [infra]
9. 🚀 Lanzamiento (Fase 11)
```

## Cierre de la serie

Los 15 documentos de `docs/estado-2026-07/` dejan la **foto completa** del estado
real: inventario, arquitectura, DB/RLS, API, config, tests, seguridad,
integraciones, reglas de negocio, deuda, dependencias, visual, fases y desvíos.
Próximos pasos naturales: (a) **actualizar el libro** (Cap. 4, 11, 18, 19) con lo
detectado; (b) atacar los P0/P1 de este documento rumbo a Fase 11.

_Fin del Documento 15 — fin de la serie Estado 2026-07._
