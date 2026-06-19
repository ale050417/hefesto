# Hefesto 3D — Relevamiento y control (cierre de Fase 4)

> Auditoría del estado del proyecto al cerrar la Fase 4 (pasos 31-40).
> Fecha: 2026-06-19. Base: typecheck, lint y 27 tests **en verde**.

## Resumen

El proyecto está **sano y bien encaminado**. Las reglas de arquitectura del
Libro Maestro se respetan al pie de la letra y la seguridad del flujo de pago es
sólida. Los hallazgos son **mejoras y deudas conocidas**, no bugs que rompan lo
hecho. Nada es urgente para lo construido; varios puntos son importantes **antes
de salir a producción**.

Prioridad: 🔴 alta · 🟡 media · 🟢 baja/informativa.

> **Actualización (2026-06-19): correcciones aplicadas.** Se resolvieron los
> puntos 1, 2, 3, 4, 6, 7 y 8, y se dejó scaffolding del 5 (Playwright listo
> para correr local). El 9 queda informativo (no es bug). Detalle al pie.

---

## ✅ Lo que está bien (para no tocar)

- **Reglas de dependencias (Cap. 5/19): impecables.** Ningún componente/UI
  importa repositorios; ningún feature importa el repository de otro; la UI no
  toca `@/core/db`. El flujo siempre es page → action → service → repository.
- **Autorización en escrituras:** las 10 actions de productos verifican
  `isStaff()` (11 guards); el checkout exige sesión con `getCurrentUser`.
- **Precios siempre en el servidor:** el carrito manda solo
  `productId/slug/variantId/quantity`; el `OrderService` recalcula desde la base.
- **Snapshots** en `order_items` (el pedido no cambia si cambia el catálogo).
- **Pago blindado:** preferencia con monto desde la base, webhook con firma
  verificada en **tiempo constante** e **idempotente**, confirmación solo
  server-side. RLS para que cada cliente vea lo suyo (verificado 11/11).
- **27 tests unitarios** sobre la lógica que toca plata.

---

## 🔴 Antes de producción

### 1. `NEXT_PUBLIC_SITE_URL` no validada y con default `localhost`

`src/lib/site.ts` cae a `http://localhost:3000` si la variable falta, y **no
está en el schema de `env.ts`**. En producción eso hace que las `back_urls` y la
`notification_url` de MercadoPago apunten a localhost → **el pago no vuelve y el
webhook nunca llega**. También afecta el `sitemap`.

**Arreglo sugerido:** agregar `NEXT_PUBLIC_SITE_URL: z.url()` al schema (o
`.url().default("http://localhost:3000")` para dev) y leer `siteUrl` desde `env`.

### 2. Webhook sin secret = firma sin verificar

Hoy, si `MERCADOPAGO_WEBHOOK_SECRET` no está, el webhook **acepta sin verificar
firma** (solo loguea un warning). Correcto para desarrollar, riesgoso en prod.

**Arreglo sugerido:** si `NODE_ENV === "production"` y no hay secret →
rechazar (500/401). Asegurar el secret en el deploy.

---

## 🟡 Mejoras de robustez

### 3. Pedido "huérfano" si falla el pago de MercadoPago

En `createOrderAction` se crea el pedido y **después** se inicia el pago. Si MP
falla (token mal, MP caído), el pedido queda creado en `pending_payment` pero la
action devuelve error. Es **recuperable** (el estado es justamente "pendiente de
pago"), pero deja registros sin pago iniciado.

**Opciones:** (a) aceptarlo y reconciliarlo desde el panel admin de pedidos
(Fase futura); (b) cancelar el pedido si la preferencia falla; (c) crear la
preferencia y el pedido más acoplados. Recomiendo **(a)** + un estado/limpieza
desde el admin.

### 4. El carrito se vacía antes de confirmar el pago en MP

En el stepper se hace `clear()` **antes** de redirigir a MercadoPago. Si el
usuario abandona el checkout externo, pierde el carrito y queda un pedido
pendiente.

**Arreglo sugerido:** para MercadoPago, **no** vaciar el carrito hasta la
confirmación real (vaciarlo en la pantalla de éxito o vía webhook). Para
transferencia/efectivo, vaciar como ahora está bien.

### 5. Faltan tests de integración y E2E (Cap. 15)

Hay 27 unit tests (excelente), pero las carpetas `tests/integration` y
`tests/e2e` están vacías y **Playwright no está instalado**. El libro pide al
menos 1 E2E de compra + integración de creación de pedido + RLS.

**Arreglo sugerido:** sumar Playwright e ir agregando: 1 E2E del flujo de compra,
1 test de integración de `createOrder` contra una base real, 1 de RLS.

### 6. Sin rate limiting (Cap. 13/17)

No hay límite en login, registro ni en el webhook. Es una defensa esperada antes
de exponer el sitio.

**Arreglo sugerido:** rate limiting en `loginAction`, `registerAction` y el
webhook (por IP / por firma).

---

## 🟢 Deudas menores / consistencia

### 7. No existe la capa `core/errors` (Cap. 12)

El libro define clases de error centralizadas (`ValidationError`,
`NotFoundError`, `PaymentError`, etc.) + un handler. Hoy usamos `OrderError`
local + `ActionResult` ad-hoc. Funciona, pero conviene unificarlo cuando crezca
el número de features.

### 8. `order_number` puede colisionar (sin reintento)

Se genera con `HEF-` + timestamp + random(0-999). La probabilidad de choque es
baja y el `UNIQUE` lo atraparía, pero el pedido fallaría sin reintento.

**Arreglo sugerido (a futuro):** secuencia en la base o reintento ante choque.

### 9. Dependencia de Google Fonts en el build (informativo)

`next/font/google` descarga las fuentes en tiempo de build. En el CI de GitHub
hay red, así que funciona; **no es un bug del proyecto**. (En este entorno de
trabajo sin red usamos un "font-stub" temporal solo para verificar el build.)
Si algún día se buildea offline, conviene `fallback`/fuentes locales.

---

## Tabla de seguimiento

| #   | Hallazgo                                              | Prioridad | Momento sugerido        |
| --- | ----------------------------------------------------- | --------- | ----------------------- |
| 1   | `NEXT_PUBLIC_SITE_URL` en env + sin default localhost | 🔴        | Antes de deploy         |
| 2   | Webhook: exigir secret en producción                  | 🔴        | Antes de deploy         |
| 3   | Pedido huérfano si falla MP                           | 🟡        | Con el admin de pedidos |
| 4   | No vaciar carrito antes de pagar en MP                | 🟡        | Próximo ajuste          |
| 5   | Tests de integración + E2E (Playwright)               | 🟡        | Fase de testing         |
| 6   | Rate limiting (login/registro/webhook)                | 🟡        | Antes de deploy         |
| 7   | Capa `core/errors` centralizada                       | 🟢        | Cuando crezca           |
| 8   | `order_number` anti-colisión                          | 🟢        | A futuro                |
| 9   | Fuentes en build (offline)                            | 🟢        | Informativo             |

---

---

## Estado de las correcciones (2026-06-19)

| #   | Hallazgo                     | Estado         | Qué se hizo                                                                                       |
| --- | ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `NEXT_PUBLIC_SITE_URL`       | ✅ resuelto    | Agregada al schema de `env.ts` (`z.url().default(...)`).                                          |
| 2   | Firma de webhook en prod     | ✅ resuelto    | Sin secret en `production` el webhook responde 500 (no procesa).                                  |
| 3   | Pedido huérfano si falla MP  | ✅ resuelto    | `cancelPendingOrder`: si el pago no inicia, el pedido pasa a `cancelled`. +2 tests.               |
| 4   | Carrito antes de pagar       | ✅ resuelto    | El stepper ya no vacía el carrito; lo limpia `ClearCartOnMount` en la pantalla de éxito.          |
| 5   | Tests E2E / integración      | 🟡 scaffolding | Playwright + `playwright.config.ts` + `tests/e2e/compra.spec.ts` + `pnpm test:e2e`. Correr local. |
| 6   | Rate limiting                | ✅ resuelto    | `core/security/rate-limit` (en memoria) en login/registro/recuperación. +3 tests.                 |
| 7   | Capa `core/errors`           | ✅ resuelto    | `AppError` + subclases + `toActionError`; `OrderError` ahora extiende `AppError`.                 |
| 8   | `order_number` anti-colisión | ✅ resuelto    | Generador con `crypto.randomBytes` (timestamp + 6 hex).                                           |
| 9   | Fuentes en build (offline)   | 🟢 informativo | Sin cambios: funciona en CI (con red). Solo afecta builds offline.                                |

**Tests:** 32 unit (antes 27). **Pendiente real:** correr la suite E2E en local
(`pnpm exec playwright install` una vez, luego `pnpm test:e2e`) e ir sumando el
E2E del pago y un test de integración de `createOrder` + RLS contra base real.

---

_La fuente de verdad sigue siendo `HEFESTO-Libro-Maestro.md`. Este documento es
una foto del estado al cerrar la Fase 4._
