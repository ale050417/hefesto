# Hefesto 3D — Resumen de la Fase 6 (Cuenta del cliente)

Continúa donde terminó `FASE-5.md`. Explica **qué construimos**, **para qué** y
**cómo se conecta**. Con esta fase **se cierra el MVP (Fases 0–6)**.

> Resultado de la Fase 6: el cliente tiene su **espacio propio** — "Mis pedidos"
> con seguimiento, sus **datos y direcciones**, y una **lista de favoritos**.
> Todo protegido para que **cada uno vea solo lo suyo** (RLS).

---

## 1. La base de datos (migración 0009)

Dos tablas nuevas, ambas con **RLS** (cada cliente solo lo suyo):

- **`addresses`** — direcciones de envío: `label`, `full_name`, `phone`,
  `street`, `city`, `province`, `postal_code`, `is_default`.
- **`wishlist_items`** — favoritos: `customer_id` + `product_id`, con
  **`unique(customer_id, product_id)`** (no se repite un favorito).

Además, una política para que el cliente pueda **editar su propio perfil**
(`profiles_update_own`).

> Verificado contra Postgres real (pglite): RLS activado, el `unique` rechaza
> duplicados y cada cliente ve únicamente sus direcciones y favoritos.

---

## 2. "Mis pedidos" — Paso 48

`/cuenta/pedidos`: la lista de pedidos del cliente (tarjetas con número, fecha,
estado y total). Cada una abre `/cuenta/pedidos/[numero]` con:

- El **resumen** del pedido (ítems, totales, pago, envío).
- El **seguimiento**: el código de tracking (si lo hay) y la **línea de tiempo**
  de estados.

Capa: `orders.getMyOrders` y `orders.getOrderForCustomer` (este último ya valida
que el pedido sea del cliente; si es ajeno, 404).

---

## 3. Perfil + direcciones — Paso 49

`/cuenta/perfil`:

- **Mis datos**: nombre y teléfono (formulario con React Hook Form →
  `updateProfileAction`).
- **Direcciones**: lista con su etiqueta y "principal", más un formulario para
  **agregar** y botón para **eliminar**.

Capa: `features/customers` (schemas Zod, repository, service con **chequeo de
propiedad**, actions). Las reglas y la autorización viven en el servidor.

---

## 4. Wishlist (favoritos) — Paso 50

- **Corazón en cada card** de producto (estilo del demo). Al tocarlo,
  guarda/saca el favorito al instante; si no hay sesión, te lleva a ingresar.
- `/cuenta/favoritos`: la grilla con los productos guardados.

Cómo funciona por debajo: un **store** liviano (Zustand) carga una vez los ids
de favoritos del usuario (`WishlistLoader` en el layout); el botón
(`WishlistButton`) lee/actualiza ese store y llama a `toggleWishlistAction`. La
página de favoritos pide los ids y arma las vistas con el servicio de productos
(`listProductsByIds`).

---

## 5. Seguridad (RLS) — Paso 51

Incluida en la migración `0009`: `addresses`, `wishlist_items` y la actualización
de `profiles` quedan restringidas a su dueño. La app entra con Drizzle (rol
`postgres`, que saltea RLS), así que las políticas son la **red final** de la API
pública de Supabase. En el servidor, además, cada servicio verifica la propiedad.

---

## 6. Estructura y accesos

- **`/cuenta`** tiene su propio layout con **candado de sesión** (sin sesión →
  login con `redirect`) y **pestañas** (Mis pedidos · Perfil y direcciones ·
  Favoritos).
- El **header** suma el link **"Mi cuenta"** cuando hay sesión.
- Diseño alineado al **demo** (`index.html`): tabs de cuenta, tarjetas de pedido,
  corazón de favorito, tema claro.

---

## 7. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm install
pnpm db:migrate     # aplica 0009 (addresses, wishlist_items, RLS)
pnpm dev
```

- Logueate → te aparece **"Mi cuenta"** en el header.
- `/cuenta/pedidos` → tus pedidos (hacé uno antes desde el checkout).
- `/cuenta/perfil` → editá tus datos y agregá una dirección.
- Tocá el **corazón** en una card del catálogo → aparece en `/cuenta/favoritos`.

---

## 8. Qué sigue

El **MVP (Fases 0–6) está completo**: catálogo, carrito, checkout, pagos,
gestión de pedidos, emails y cuenta del cliente. Lo que viene son fases de
extensión:

- **Fase 7 — Inventario** (filamentos por color en gramos, alertas de stock).
- **Fase 8 — Cupones / descuentos**.
- **Fase 9/10 — Reportes y deploy**.

---

_Documento generado al cierre de la Fase 6. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
