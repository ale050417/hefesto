# Documento 8 — Integraciones externas

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 8 de 15.**
**Integraciones:** MercadoPago (pagos), Resend (emails), Supabase (Auth, DB,
Storage). Patrón común: **degradación elegante** — si falta la config, la feature
se apaga con mensaje claro y la app no se cae.

## 1. MercadoPago (pagos)

**Archivos:** `core/payments/mercadopago.ts`, `features/orders/services/paymentService.ts`,
`app/api/webhooks/mercadopago/route.ts`.

| Aspecto                   | Estado                                                                            |
| ------------------------- | --------------------------------------------------------------------------------- |
| Crear preferencia de pago | ✅ `createPreference` (SDK `mercadopago ^3.1.0`)                                  |
| Config detectada          | ✅ `isMercadoPagoConfigured()` (chequea `MERCADOPAGO_ACCESS_TOKEN`)               |
| Inicio de pago            | ✅ `startMercadoPagoPayment` (solo para método MP; transfer/efectivo van a éxito) |
| Confirmación              | ✅ **solo** por webhook (`confirmOrderPayment`), nunca desde el navegador         |
| Webhook: firma            | ✅ `verifyWebhookSignature` (HMAC x-signature/x-request-id)                       |
| Webhook: secret en prod   | ✅ **obligatorio** (500 si falta)                                                 |
| Webhook: idempotencia     | ✅ `confirmOrderPayment` idempotente; 500 → MP reintenta                          |
| back_urls                 | Dependen de `NEXT_PUBLIC_SITE_URL` (Doc 5)                                        |

**Qué pasa si falla:**

- Sin `ACCESS_TOKEN`: el checkout con MP falla con mensaje; si el inicio de pago
  falla, `createOrderAction` **cancela el pedido** para no dejarlo huérfano en
  `pending_payment` (visto en `orders/actions.ts`). ✅
- Webhook caído / 500: MP reintenta; al ser idempotente no duplica confirmación.
- 🟡 **Riesgo operativo:** el pedido depende del webhook para confirmarse. Si el
  webhook nunca llega (mala config de URL/secret en prod), el pago queda cobrado
  en MP pero el pedido en `pending_payment`. Mitigación sugerida: job/manual de
  reconciliación o botón admin "verificar pago" (consulta `getPayment`).

## 2. Resend (emails transaccionales)

**Archivos:** `core/email/index.ts`, `features/orders/services/orderEmails.ts`,
notificaciones por transición.

| Aspecto                     | Estado                                                       |
| --------------------------- | ------------------------------------------------------------ |
| Envío                       | ✅ `sendEmail` (`resend ^6.14.0`)                            |
| Config detectada            | ✅ `isEmailConfigured()` (`RESEND_API_KEY`)                  |
| Emails por estado de pedido | ✅ `notifyOrderStatus` / `buildOrderStatusEmail`             |
| Ejecución                   | ✅ **en segundo plano** (`after()`), no bloquea la respuesta |
| Degradación                 | ✅ sin API key, el email **se omite** (no rompe la acción)   |

**Qué pasa si falla:** cada envío está en `try/catch` y se loguea; un fallo de
email **no** frena el cambio de estado ni el pedido. ✅ Correcto para no acoplar
el negocio al proveedor de email.

🟡 **Observación:** los emails se disparan desde varios puntos (webhook +
`transitionOrderAction`). Verificar que no haya **doble email** cuando el pago se
confirma por webhook y además hay una transición manual.

## 3. Supabase (Auth + DB + Storage)

**Archivos:** `core/supabase/{server,browser,admin}.ts`, `core/storage/index.ts`,
`core/db/index.ts`, `middleware.ts`.

| Servicio                     | Estado                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Auth                         | ✅ SSR (`@supabase/ssr`), sesión refrescada en middleware, callback route    |
| DB                           | ✅ Postgres vía Drizzle (`postgres ^3.4.9`), RLS activa (Doc 3/7)            |
| Storage                      | ✅ `uploadObject`/`deleteObject`/`optimizeImage` (bucket público `products`) |
| Cliente admin (service-role) | ✅ solo server (`admin.ts`): crear usuario, set password, listar emails      |

**Storage — detalle:** las imágenes (marca, banners, productos, chat a medida) se
**optimizan a WebP con `sharp`** antes de subir; el server valida tipo (JPG/PNG/WebP)
y tamaño (≤8 MB, alineado con `serverActions.bodySizeLimit`). ✅

**Qué pasa si falla:**

- Storage caído: la subida de imagen falla con error de acción; el resto del CRUD
  sigue.
- DB caída: falla la operación (los servicios propagan `AppError`).
- Auth caído: middleware no obtiene user → `/admin` redirige a login.

## Estado de configuración para producción

| Integración | Var(es) requerida(s) en prod                                                     | Bloquea si falta      |
| ----------- | -------------------------------------------------------------------------------- | --------------------- |
| MercadoPago | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` | Cobros / confirmación |
| Resend      | `RESEND_API_KEY`, `RESEND_FROM`                                                  | Solo emails (degrada) |
| Supabase    | `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DATABASE_URL`       | Toda la app           |

## Riesgos y recomendaciones

1. 🔴 **Reconciliación de pagos**: agregar verificación manual/automática para
   pedidos que quedan en `pending_payment` pese a pago aprobado (webhook perdido).
2. 🟡 **Doble email**: auditar disparadores de email en confirmación de pago.
3. 🟢 **Remover `picsum.photos`** de `remotePatterns` al pasar a catálogo real.

_Fin del Documento 8._
