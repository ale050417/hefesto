# Hefesto 3D — Fase 9.5: Paridad funcional con el demo (`index.html`)

> **Objetivo:** llevar el proyecto a la **misma experiencia del demo** — no solo
> el diseño, sino **lo que el demo hace**: cada botón que abre algo, cada modal,
> drawer, chat, reseña y pantalla del back-office. El `index.html` es la
> referencia de "producto real" que buscamos.
>
> Este documento es el **relevamiento completo** del demo + el **gap** contra lo
> construido + el **plan de la Fase 9.5** (priorizado en sub-fases). Se inserta
> entre la Fase 9 (Reportes) y la Fase 10 (deploy/hardening).

Leyenda: ✅ hecho · 🟡 parcial · ❌ falta · 🔵 a evaluar (feature avanzada/demo).

---

## A. Storefront (cliente)

| Funcionalidad (demo)                      | Estado | Detalle / qué falta                                                                                                               |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Home con todas las secciones              | ✅     | Hero, banda, categorías, nuevos, números, ofertas, materiales, más vendidos, galería, cómo funciona, testimonios, FAQ, newsletter |
| Catálogo con filtros + orden              | ✅     | Categoría, precio, material, novedad/oferta, sort                                                                                 |
| **Buscador**                              | 🟡     | Hay buscador básico (header → /catalogo?q). Falta **overlay con resultados en vivo** (como el demo)                               |
| Detalle de producto                       | 🟡     | Falta **selector de color**, **galería con miniaturas**, **productos relacionados**, **reseñas**                                  |
| Carrito (drawer) + cupón                  | ✅     | Cantidades, cupón, subtotal                                                                                                       |
| Checkout (3 pasos)                        | ✅     | Envío → pago → confirmación                                                                                                       |
| **Reseñas de productos**                  | ❌     | Estrellas + comentarios; escribir reseña; ver en el detalle                                                                       |
| **Pedidos "A medida"** (solicitud custom) | ❌     | Pedir presupuesto con descripción + imagen de referencia; estado; cotización; pagar                                               |
| **Chat** (en pedido y en pedido a medida) | ❌     | Mensajería cliente ↔ taller                                                                                                       |
| **Notificaciones del cliente** (campana)  | ❌     | Listado de avisos (pedido confirmado, listo, etc.)                                                                                |
| WhatsApp flotante                         | ❌     | Botón flotante de contacto                                                                                                        |
| Volver arriba / banner promo / tema       | ✅     | Hechos en la tanda de paridad                                                                                                     |
| Newsletter                                | ✅     | Form (cliente)                                                                                                                    |

## B. Cuenta del cliente (`/cuenta`)

| Funcionalidad (demo)            | Estado | Detalle                         |
| ------------------------------- | ------ | ------------------------------- |
| Mis pedidos + seguimiento       | ✅     | Lista + detalle con timeline    |
| Perfil + direcciones            | ✅     | Datos + ABM de direcciones      |
| Favoritos                       | ✅     | Grilla wishlist                 |
| **Cambiar contraseña**          | ❌     | `acc-pass`                      |
| **Mis pedidos a medida** + chat | ❌     | Crear/ver solicitudes y chatear |
| Chat por pedido                 | ❌     | `acc-chat`                      |

## C. Back-office (admin)

| Vista del demo                               | Estado | Detalle                                                                                |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Dashboard (KPIs + gráfico)                   | ✅     | Fase 9                                                                                 |
| Pedidos (tabla + detalle + estados)          | ✅     | Fase 5                                                                                 |
| Productos / Categorías                       | ✅     | Fase 2                                                                                 |
| Filamentos / Fallas                          | ✅     | Fase 7                                                                                 |
| Descuentos                                   | ✅     | Fase 8                                                                                 |
| Reportes                                     | ✅     | Fase 9                                                                                 |
| Auditoría / Apariencia                       | ✅     | Fase 5 / config de marca                                                               |
| **Pedidos a medida** (gestión)               | ❌     | Bandeja de solicitudes + cotizar + chat                                                |
| **Clientes** (fichas)                        | ❌     | Listado + detalle (pedidos, datos, gasto)                                              |
| **Configuración** (settings completa)        | 🟡     | Hoy solo logo/hero. Falta negocio, redes, WhatsApp, medios de pago, secciones del home |
| **Reseñas** (moderar/responder)              | ❌     | `reply-review`, `feature-review`                                                       |
| Búsqueda global (admin)                      | ❌     | `global-search`                                                                        |
| Notificaciones (admin)                       | ❌     | Campana                                                                                |
| Cola de impresión / impresoras               | 🔵     | `ViewProduccion` — operativo de taller                                                 |
| Recompensas / puntos                         | 🔵     | `ViewRecompensas`                                                                      |
| Ganancias y socios                           | 🔵     | `ViewGanancias`                                                                        |
| Calculadora 3D de precios                    | 🔵     | `ViewCalculadora`                                                                      |
| Roles / permisos (UI)                        | 🔵     | `ViewRoles` (ya hay roles en DB)                                                       |
| Superadmin / multi-tenant                    | 🔵     | `ViewSuperadmin` — fuera del alcance de un solo negocio                                |
| Importar ventas / venta manual               | 🔵     | `import-sales`, `manual-sale`                                                          |
| Banners del hero editables, pricing dinámico | 🔵     | `add-banner`, `dyn-pricing`                                                            |

## D. Interacciones transversales (el "toco y aparece algo")

El demo abre **modales** (`openModal`, ~30 usos) y **drawers** (~10) y muestra
**toasts** (~130). Hoy el proyecto usa **navegación a páginas** y formularios.
Para igualar la sensación del demo conviene una base de UI compartida:

- **Modal / Dialog** reutilizable (overlay + foco + cerrar con Esc).
- **Drawer** (ya existe el del carrito; generalizarlo).
- **Toasts** (avisos efímeros tras una acción).
- **Dropdown** (menús: notificaciones, usuario).

Esto es la base para reseñas, chat, "a medida", notificaciones y varios modales
del admin.

---

## Plan de la Fase 9.5 (sub-fases priorizadas)

Cada sub-fase cierra con **control + tests + documento** (igual que cada fase).
Orden pensado por **valor para el negocio real** y dependencias.

### 9.5.0 — Base de UI (modales, toasts, dropdown)

Primitivos compartidos (Modal, Toast/Toaster, Dropdown) con el estilo del demo.
Habilita todo lo demás. Sin migración.

### 9.5.1 — Detalle de producto completo

Galería con **miniaturas**, **productos relacionados** (misma categoría),
**selector de color** (si el producto define colores), cantidad. Reusa
`findRelated` (ya existe).

### 9.5.2 — Reseñas de productos

Migración `reviews` (producto, cliente, rating 1–5, comentario, aprobada). Form
en el detalle (solo quien compró/logueado), promedio + listado, y **moderación**
en el admin. Tests del promedio/validación. RLS.

### 9.5.3 — Pedidos "A medida" (núcleo del demo)

Migración `custom_requests` + `custom_messages`. Cliente: solicitar (descripción

- imagen), ver estado, **chat**, pagar cuando lo cotizan. Admin: bandeja,
  **cotizar**, chatear, cambiar estado. Tests del flujo de estados.

### 9.5.4 — Chat por pedido

Mensajería cliente ↔ taller dentro de un pedido (reusa la base de 9.5.3).

### 9.5.5 — Notificaciones del cliente

Migración `notifications`. Campana con contador + listado; se generan en las
transiciones de pedido (engancha con los emails ya existentes).

### 9.5.6 — Admin: Clientes

Listado de clientes con su gasto/pedidos y ficha de detalle (solo lectura).

### 9.5.7 — Configuración completa

Ampliar `business_settings`: nombre, descripción, WhatsApp, redes, medios de
pago habilitados, toggles de secciones del home. Panel en `/admin/configuracion`.

### 9.5.8 — Pulidos de UX

Buscador con **overlay/resultados en vivo**, **WhatsApp flotante**, **cambiar
contraseña** en la cuenta.

### 9.5.9 — Recompensas / puntos (elegida)

Programa de fidelización: el cliente acumula puntos por compra y los canjea.
Migración `rewards`/`point_transactions`. Reglas en servicio + tests.

### 9.5.10 — Calculadora 3D de precios (elegida)

Herramienta del admin para estimar el precio de una pieza (peso, tiempo,
material, margen). Lógica pura testeable; sin migración (o config opcional).

### 9.5.11 — Cola de impresión / impresoras (elegida)

Operativo de taller: impresoras y trabajos de impresión con estado.
Migración `printers`/`print_jobs`. RLS solo staff.

### Aún a evaluar (🔵, fuera del plan por ahora)

Ganancias y socios, gestión de roles por UI, superadmin/multi-tenant, importar
ventas, banners/pricing dinámico.

---

## Cómo seguimos

Propuesta: ejecutar **9.5.0 → 9.5.8 en orden**, una sub-fase por tanda, cada una
con su control/tests/documento. Empezamos por **9.5.0 (base de UI)** porque
desbloquea reseñas, chat, "a medida" y notificaciones.

_Documento de planificación de la Fase 9.5. La fuente de verdad de arquitectura
sigue siendo `HEFESTO-Libro-Maestro.md`; este plan extiende el alcance hacia la
paridad con el demo a pedido del dueño._

---

## Progreso de ejecución

- **9.5.0 Base de UI** ✅ — Modal, Toaster + `toast()`, Dropdown (en `components/ui`), montados globalmente.
- **9.5.1 Detalle de producto** ✅ — galería con miniaturas **interactivas** + relacionados (ya existían).
- **9.5.2 Reseñas** ✅ — migración `0013_reviews` (rating 1–5 + unique por cliente/producto + RLS aprobada-o-propia), feature `reviews` (promedio + listado + form en el detalle, moderación en `/admin/resenas`), 2 tests + pglite 5/5.

Pendientes: 9.5.3 a medida+chat · 9.5.4 chat por pedido · 9.5.5 notificaciones · 9.5.6 clientes · 9.5.7 configuración · 9.5.8 pulidos · 9.5.9 recompensas · 9.5.10 calculadora · 9.5.11 cola de impresión.
