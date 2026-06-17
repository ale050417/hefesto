# Hefesto 3D — Resumen de la Fase 3 (Autenticación y seguridad)

Continúa donde terminó `FASE-2.md`. Explica **qué construimos**, **para qué** y
**cómo se conecta**.

> Resultado de la Fase 3: hay **cuentas de usuario** (registro, login,
> recuperación) y el panel **`/admin` quedó cerrado bajo llave**. Las escrituras
> verifican rol y la base tiene su "red final" (RLS).

---

## 1. Cómo funciona la autenticación (la idea)

Usamos **Supabase Auth**. Los usuarios viven en `auth.users` (email, contraseña
hasheada) — eso lo maneja Supabase. Nosotros guardamos el **rol** y datos extra
en nuestra tabla **`profiles`**.

La sesión viaja en **cookies httpOnly** (el JavaScript del navegador no las
puede leer → protege contra XSS, Cap. 13). Un **middleware** refresca esa sesión
en cada navegación.

```
Navegador (cookies httpOnly)
   │
Middleware (refresca sesión, protege /admin)
   │
Server Components / Server Actions  ←  leen quién sos con getCurrentUser()
```

---

## 2. La plomería de Supabase

| Archivo                    | Para qué                                                                          |
| -------------------------- | --------------------------------------------------------------------------------- |
| `core/supabase/server.ts`  | Cliente para Server Components / actions (lee/escribe la sesión en cookies)       |
| `core/supabase/browser.ts` | Cliente para componentes de cliente                                               |
| `src/middleware.ts`        | Refresca la sesión en cada request **y** protege `/admin` (candado 1)             |
| `core/auth/session.ts`     | `getCurrentUser()`, `requireStaff()` (candado 2) e `isStaff()` (guard de actions) |

---

## 3. `profiles` + roles + trigger (migración 0003)

- **Enum `user_role`** = `customer | operator | admin`.
- Tabla **`profiles`**: `id` (= id de `auth.users`), `full_name`, `phone`,
  **`role`** (default `customer`), `created_at`.
- **Trigger `on_auth_user_created`**: cuando alguien se registra, la base crea
  automáticamente su `profile` con rol `customer` (verificado: el trigger anda y
  el borrado en cascada también).

**Regla:** el rol inicial **siempre** es `customer`. `operator`/`admin` se
asignan a mano (por SQL en Supabase). El rol **nunca** viene del cliente: se lee
del `profiles` en el servidor.

---

## 4. Login / Registro / Recuperación

| Archivo                                          | Qué es                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `features/auth/schemas.ts`                       | Zod: login, registro (con **confirmar contraseña**), recuperación             |
| `features/auth/actions.ts`                       | `loginAction`, `registerAction`, `logoutAction`, `requestPasswordResetAction` |
| `features/auth/components/*`                     | `LoginForm`, `RegisterForm`, `ResetForm` (React Hook Form)                    |
| `app/(storefront)/{ingresar,registro,recuperar}` | Las páginas                                                                   |

- Todo pasa por **Server Actions** (las cookies se setean en el servidor).
- La recuperación responde **siempre** "te enviamos un email" (anti-enumeración:
  no revela si el email existe, Cap. 13).
- El **Header** ahora es consciente de la sesión: muestra **Ingresar** o
  **Salir**, y un link **Panel** si sos admin/operador. Es **resiliente**: si
  falla la lectura del perfil, no tumba el sitio.

---

## 5. 🔒 Protección de `/admin` (dos candados en el servidor)

1. **Middleware** → si entrás a `/admin/*` sin sesión, te manda a
   `/ingresar?redirect=...`.
2. **Layout del admin** (`requireStaff`) → si estás logueado pero **no sos
   admin/operador**, te manda al inicio.

(La UI nunca es seguridad; los candados reales están en el servidor, Cap. 13.)

---

## 6. RLS inicial (migración 0004) + autorización en actions

**RLS (Row Level Security)** = la base decide, fila por fila, quién puede ver
qué. La migración `0004` activa RLS y agrega políticas:

- **Catálogo** (productos, categorías, imágenes, variantes, tags): **lectura
  pública** (productos solo si están `published`).
- **`profiles`**: cada usuario **solo ve el suyo**.

> Importante: la app entra a la base con **Drizzle** usando el rol `postgres`,
> que **saltea RLS** — por eso el admin sigue viendo todo (incluidos borradores).
> Las políticas son la **red final** para la API pública de Supabase (si alguien
> usara la publishable key directamente).

**Autorización en las escrituras (`requireRole`):** las 10 Server Actions de
escritura (productos, imágenes, categorías) verifican `isStaff()` antes de tocar
la base. Aunque alguien saltee la UI, la action responde **"No autorizado"**.
Defensa en profundidad: UI → middleware → action (rol) → RLS.

---

## 7. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm db:migrate     # aplica 0003 (profiles+trigger) y 0004 (RLS)
pnpm dev
```

- `/registro` → crear cuenta (con confirmar contraseña).
- Convertirte en admin (una vez), en Supabase → SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'TU-EMAIL');
```

- `/admin` sin sesión → te manda a `/ingresar`. Como admin → entrás.

---

## 8. Qué sigue

**Fase 4 — Carrito + Checkout + Pagos** (Cap. 18, pasos 31–40), el **corazón**:
al terminarla, **Hefesto ya vende**. Incluye lógica que toca plata, con **tests
en el momento** (Cap. 15).

---

_Documento generado al cierre de la Fase 3. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
