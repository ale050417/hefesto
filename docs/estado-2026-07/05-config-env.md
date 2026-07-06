# Documento 5 — Configuración y variables de entorno

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 5 de 15.**
**Fuente:** `src/core/config/env.ts` (Zod), `src/lib/site.ts`, usos de `process.env`.

## Modelo de configuración

`core/config/env.ts` **valida el entorno con Zod al arrancar**: si falta o está
mal una variable, la app **falla con mensaje claro** en vez de romperse tarde.
`SKIP_ENV_VALIDATION=1` desactiva la validación en el build de CI (sin secretos);
en runtime siempre corre. Buen patrón (Cap. 14). Existe **`.env.example`** (bien)
y `.env.local` (local).

## Variables declaradas (env.ts)

| Variable                                | Tipo        | Requerida                       | Uso                                    |
| --------------------------------------- | ----------- | ------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                  | url         | Default `http://localhost:3000` | back_urls MP, sitemap, links de emails |
| `NEXT_PUBLIC_SUPABASE_URL`              | url         | **Sí**                          | Cliente Supabase                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | string      | **Sí**                          | Publishable key Supabase               |
| `SUPABASE_SERVICE_ROLE_KEY`             | string      | **Sí** (secreto)                | Cliente admin server                   |
| `DATABASE_URL`                          | postgres:// | **Sí** (secreto)                | Drizzle/Postgres                       |
| `MERCADOPAGO_ACCESS_TOKEN`              | string      | Opcional                        | Cobros MP                              |
| `MERCADOPAGO_WEBHOOK_SECRET`            | string      | Opcional\*                      | Verificar firma webhook                |
| `RESEND_API_KEY`                        | string      | Opcional                        | Emails                                 |
| `RESEND_FROM`                           | string      | Opcional                        | Remitente emails                       |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | string      | Opcional                        | Observabilidad (aún sin SDK)           |
| `NEXT_PUBLIC_ANALYTICS_ID`              | string      | Opcional                        | Analytics                              |

\* Opcional en el schema, pero el **webhook la exige en producción** (500 si falta).

## Hallazgos

### ✅ Resueltos (ya no son deuda)

- **`SITE_URL` NO está hardcodeada.** Viene de `NEXT_PUBLIC_SITE_URL` con default
  localhost y, en `NODE_ENV=production` sin la var, `env.ts` **loguea un error
  fuerte** ("MercadoPago, sitemap y emails van a apuntar a localhost"). Esto
  cierra la deuda histórica de SITE_URL.
- **Secret del webhook de MP** es variable de entorno y su ausencia en prod
  bloquea el procesamiento (no se hardcodeó, no se ignora en prod).
- **Sin secretos hardcodeados en el código.** Todo pasa por `env`.

### 🟡 Menores

1. **`NEXT_PUBLIC_WHATSAPP_PHONE`** se lee con `process.env` directo en
   `lib/site.ts` **pero no está declarada en `env.ts`** → no validada. Sumarla al
   schema para consistencia.
2. **`NEXT_PUBLIC_ANALYTICS_ID`** está declarada en `env.ts` pero **no aparece
   usada** en el código → config muerta o pendiente de cablear. Decidir: cablear
   analytics o quitar la var.
3. **`NEXT_PUBLIC_SITE_URL` con default localhost**: cómodo para dev, pero el
   único resguardo en prod es un `console.error` (no un throw). Un olvido en
   Vercel no rompe el build; rompe silenciosamente los links. Considerar exigirla
   (sin default) cuando `NODE_ENV=production`.

### Checklist de entorno para producción (Fase 11)

| Var                                          | Debe estar en prod        |
| -------------------------------------------- | ------------------------- |
| `NEXT_PUBLIC_SITE_URL`                       | ✅ dominio real (crítico) |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`      | ✅                        |
| `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` | ✅ (secretos)             |
| `MERCADOPAGO_ACCESS_TOKEN`                   | ✅ para cobrar            |
| `MERCADOPAGO_WEBHOOK_SECRET`                 | ✅ (webhook lo exige)     |
| `RESEND_API_KEY` / `RESEND_FROM`             | ✅ para emails            |
| `NEXT_PUBLIC_WHATSAPP_PHONE`                 | ⚠ agregar al schema       |

## Otros archivos de configuración

| Archivo                                                         | Estado                                          |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `next.config.ts`                                                | Revisar headers de seguridad (CSP/HSTS) → Doc 7 |
| `tsconfig.json`                                                 | TS estricto ✅                                  |
| `drizzle.config.ts`, `vitest.config.ts`, `playwright.config.ts` | OK                                              |
| `eslint.config.mjs`, `postcss.config.mjs`                       | OK                                              |

_Fin del Documento 5._
