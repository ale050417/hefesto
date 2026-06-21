# Relevamiento técnico — Hefesto 3D (junio 2026)

Auditoría viva del proyecto: reglas de dependencias (Cap. 5/19), guards de
autorización, cobertura RLS y deudas técnicas. Se agrega una sección por cierre
de fase.

---

## Control + relevamiento al cierre de la Fase 4 (2026-06-19)

Base sana: reglas de dependencia Cap. 5/19 impecables, guards completos, precios
recalculados en servidor, RLS de pedidos, 27 unit tests.

Hallazgos (no bugs; mejoras/deudas) y su estado:

- 🔴 **#1 `NEXT_PUBLIC_SITE_URL` ausente en env** → back_urls/notification_url de
  MercadoPago caían a localhost. **CORREGIDO**: `z.url().default(...)` en `env.ts`.
- 🔴 **#2 webhook sin secret** aceptaba sin verificar firma. **CORREGIDO**:
  responde 500 si falta el secret en `NODE_ENV=production`.
- 🟡 **#3 pedido huérfano si falla MP**. **CORREGIDO**: `cancelPendingOrder` +
  tests.
- 🟡 **#4 carrito se vaciaba antes de redirigir a MP**. **CORREGIDO**: el
  stepper no vacía; `ClearCartOnMount` limpia en `/checkout/exito`.
- 🟡 **#5 faltaban tests de integración + E2E**. **PARCIAL**: scaffold de
  Playwright + `tests/e2e/compra.spec.ts` y `cupon.spec.ts` (correr local con
  `pnpm exec playwright install`). Falta ampliar cobertura E2E/integración.
- 🟡 **#6 sin rate limiting**. **CORREGIDO**: `core/security/rate-limit.ts`
  aplicado en login/registro/reset y en `validateCouponAction`.
- 🟢 **#7 sin capa `core/errors`**. **CORREGIDO**: `AppError` + subclases +
  `ActionResult`/`toActionError`.
- 🟢 **#8 `order_number` sin reintento ante colisión**. **CORREGIDO**:
  `crypto.randomBytes` (`HEF-<base36>-<hex>`).
- 🟢 **#9 next/font baja fuentes en build** — informativo (OK en CI; font-stub
  en el sandbox).

---

## Control + relevamiento al cierre de la Fase 10 (2026-06-21)

**Control (todo en verde):** `tsc --noEmit`, `eslint . --max-warnings=0`,
`prettier --check .`, `vitest run` (63/63), `build` (font-stub en sandbox) y
pglite de la migración 0012 (3/3).

**Reglas de dependencia (Cap. 5/19):** se mantienen. Lo nuevo respeta las capas:

- `core/observability` es infraestructura transversal sin dependencias hacia
  features; lo importan error boundaries (UI) y puede usarse desde servicios.
- `core/audit` (ya existente) lo consumen las _actions_ de `products` (capa
  action → core), no la UI ni un repository ajeno.
- `getStaffUser()` vive en `core/auth/session.ts` junto a `isStaff`/`requireStaff`.

**Guards de autorización:** las actions sensibles de catálogo
(crear/actualizar/publicar/archivar producto; crear/actualizar/borrar categoría)
verifican staff con `getStaffUser()` antes de mutar y **auditan** el resultado.
Sin cambios en la validación Zod (sigue server-side).

**Cobertura RLS:** se cierra la última tabla sin RLS, `business_settings`
(migración 0012, lectura pública / escritura solo vía Drizzle). Estado RLS:
catálogo (0004), pedidos (0006), audit_log (0008), cuenta/wishlist/addresses
(0009), inventario (0010), cupones (0011) y settings (0012).

**Seguridad:** cabeceras añadidas (nosniff, DENY frame, Referrer-Policy, HSTS,
Permissions-Policy) para todas las rutas; `poweredByHeader` desactivado.

### Deudas nuevas / pendientes tras la Fase 10

- 🟡 **CSP estricta**: se omitió en `next.config.ts` para no romper scripts
  inline de Next ni el checkout de MercadoPago. Definir CSP con **nonce** en la
  Fase 11.
- 🟡 **Sentry/Analytics reales**: hoy `core/observability` es un wrapper sobre
  `console` (sin SDK, por Cap. 4). Cablear el SDK en el deploy usando los call
  sites ya centralizados y `SENTRY_DSN`/`NEXT_PUBLIC_ANALYTICS_ID`.
- 🟡 **Migración 0009 pendiente de aplicar en Supabase** (`pnpm db:migrate`);
  ahora también 0012.
- 🟡 **E2E/integración**: ampliar la suite Playwright (compra completa con MP de
  prueba, RLS, flujos admin) — arrastrada desde la Fase 4 (#5).
- 🟢 **Auditoría de inventario/cupones**: extender `recordAudit` también a
  filamentos/fallas y cupones (hoy cubre pedidos + productos/categorías).
- 🟢 **OG image**: agregar imagen Open Graph por defecto (hoy las cards de
  compartir usan título/descripción sin imagen salvo en producto).
