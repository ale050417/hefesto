# Documento 7 — Checklist de seguridad

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 7 de 15.**

## Resumen ejecutivo

| Área                         | Estado                                                  |
| ---------------------------- | ------------------------------------------------------- |
| RLS (Row Level Security)     | ✅ Cubre las 37 tablas                                  |
| Validación server-side (Zod) | ✅ Fuerte en mutaciones                                 |
| Autorización server-side     | ✅ `can()`/`isAdmin` + middleware + layout              |
| Rate limiting                | 🟡 Solo auth + cupón, y **en memoria (no distribuido)** |
| Manejo de secretos           | ✅ Validado por env, sin hardcode                       |
| Cabeceras de seguridad       | 🟡 Buenas, **sin CSP**                                  |
| Webhook de pago              | ✅ Firma verificada + obligatoria en prod               |

## 1. RLS

- **Todas las tablas tienen RLS** (Doc 3). Últimos hardenings: `0032` (9 tablas)
  y `0035` (roles, calc_margin_presets).
- ⚠ **Pendiente de auditar el contenido de cada policy** (que además de estar
  activas sean correctas: p. ej. que un cliente solo lea sus pedidos, que staff
  no dependa solo de la app). Este doc verificó _presencia_; la _corrección_ de
  cada `CREATE POLICY` es una revisión aparte recomendada.

## 2. Validación y autorización en el servidor

- **Autorización siempre en el servidor** (Cap. 8): cada action mutante llama
  `can("modulo","accion")` o `isAdmin()`/`isStaff()`/ownership. Detalle en Doc 4.
- **Defensa en profundidad para el panel:**
  1. **Middleware**: sin sesión → redirect a `/ingresar` en `/admin/*`.
  2. **Layout `/admin`**: `requirePermissionPage` (autorización por rol).
  3. **Cada action**: `can(...)` re-chequea (no confía en que la UI ocultó el botón).
- **Dinero = solo admin**: borrar pedido, cancelar, reembolsar (`isAdmin`).
- **Zod** valida payloads mutantes (settings 13, products 9, customers 6, etc.).
  🟡 Excepción: `production/actions` sin Zod (Doc 4).

## 3. Rate limiting 🟡

| Dónde se aplica                          | Límite                   |
| ---------------------------------------- | ------------------------ |
| login / register / reset / cambiar clave | 5 (reset 3) / min por IP |
| validar cupón                            | 20 / min por IP          |

**Problemas:**

1. 🔴 **En memoria, no distribuido** (`core/security/rate-limit.ts`). En Vercel
   (serverless) **cada instancia tiene su propio contador** → el límite es
   ineficaz bajo escala/con múltiples lambdas. Para prod: mover a un store
   compartido (Upstash Redis / Supabase). Deuda ya conocida (relevamiento).
2. 🟡 **Cobertura parcial.** No hay rate-limit en: crear pedido/checkout, crear
   pedido a medida, enviar reseña, enviar mensajes de chat. Superficies abusables
   sin costo. Priorizar checkout y formularios públicos.

## 4. Secretos

- ✅ `env.ts` valida todo con Zod; **sin secretos hardcodeados** en el código.
- ✅ `SUPABASE_SERVICE_ROLE_KEY` solo se usa server-side (`core/supabase/admin.ts`).
- ✅ Secret del webhook MP obligatorio en prod.
- 🟡 `NEXT_PUBLIC_WHATSAPP_PHONE` se lee sin pasar por `env.ts` (Doc 5).

## 5. Cabeceras de seguridad (`next.config.ts`)

✅ Presentes en todas las rutas: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (cámara/mic/geo
denegados), **HSTS** (2 años, `includeSubDomains; preload`), `poweredByHeader: false`.

🟡 **Sin CSP** (Content-Security-Policy). Es una **omisión deliberada y
documentada** en el propio config (evitar romper scripts inline de Next y el
checkout de MP). Deuda: definir CSP con nonce. Sin CSP, la mitigación de XSS
depende del escape de React (bueno, pero no total).

🟢 `images.remotePatterns` permite `*.supabase.co` (bien) + `picsum.photos`
(demo). Quitar picsum al pasar a catálogo real.

## 6. Webhook de MercadoPago

✅ Verifica firma HMAC (`x-signature`/`x-request-id`), **exige el secret en
producción** (500 si falta), es **idempotente** (`confirmOrderPayment`), y el
cobro se confirma **solo** en el servidor (nunca desde el navegador). Sólido.

## Checklist final

| Ítem                                        | Estado                  |
| ------------------------------------------- | ----------------------- |
| RLS en todas las tablas                     | ✅                      |
| Corrección de cada policy auditada          | ⚠ pendiente             |
| AuthZ server en todas las mutaciones        | ✅                      |
| Zod en todas las mutaciones                 | 🟡 (falta production)   |
| Rate limit distribuido                      | 🔴 (hoy en memoria)     |
| Rate limit en checkout/formularios públicos | 🔴 falta                |
| Sin secretos hardcodeados                   | ✅                      |
| HSTS + headers base                         | ✅                      |
| CSP                                         | 🟡 ausente (deliberado) |
| Webhook firmado + idempotente               | ✅                      |

_Fin del Documento 7._
