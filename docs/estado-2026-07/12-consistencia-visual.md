# Documento 12 — Consistencia visual vs index.html

**Proyecto:** Hefesto 3D · **Fecha:** 2026-07-06 · **Doc 12 de 15.**
**Referencia:** `index.html` (demo, 8.424 líneas / 675 KB, tema light).

## Método y límite honesto

La regla del proyecto es: **toda pantalla debe verse idéntica al `index.html`**
(solo el diseño; el código es profesional). La **paridad de píxeles no se puede
verificar por análisis estático** — requiere correr la app y comparar contra el
demo. Lo que sí se puede afirmar acá:

- El **sistema de diseño del index está portado**: los componentes usan las
  mismas clases/tokens del demo (`ui-card`, `page-head`, `eyebrow`, `acc-chat`,
  `timeline`, `btn-primary/secondary/danger`, `hefl` loader, badges por variante,
  etc.). Esto es señal fuerte de fidelidad visual.
- El index demueestra **todas** las pantallas (storefront + admin); la app las
  implementa (Doc 1).

## Mapeo pantalla del index → ruta de la app

### Storefront

| Pantalla en index                                                                                                                   | Ruta                                     | Estado                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Home (hero, categorías destacadas, más vendidos, en oferta, nuevos, materiales, clientes felices, FAQ, ¿cómo funciona?, newsletter) | `/`                                      | ✅ Implementada · QA visual               |
| Categorías / catálogo                                                                                                               | `/catalogo`                              | ✅ · QA visual                            |
| Producto + relacionados                                                                                                             | `/producto/[slug]`                       | ✅ · QA visual                            |
| Mis pedidos                                                                                                                         | `/cuenta/pedidos` (+ `[numero]`)         | ✅ · QA visual                            |
| Tus favoritos                                                                                                                       | `/cuenta/favoritos`                      | ✅ · QA visual                            |
| Recompensas (cliente)                                                                                                               | `/cuenta/puntos`                         | ✅ · QA visual                            |
| Pedí algo a medida                                                                                                                  | `/cuenta/a-medida`                       | 🟠 **Diverge (en construcción)** por flag |
| ¡Pedido confirmado!                                                                                                                 | `/checkout/exito`                        | ✅ · QA visual                            |
| Creá tu cuenta / Bienvenido de vuelta                                                                                               | `/registro`, `/ingresar`                 | ✅ · QA visual                            |
| Calculadora de costos 3D (estimador)                                                                                                | modal en producto / `/admin/calculadora` | ✅ · QA visual                            |

### Admin (Panel Superadmin)

| Pantalla en index            | Ruta                         | Estado                                    |
| ---------------------------- | ---------------------------- | ----------------------------------------- |
| Panel Superadmin (dashboard) | `/admin`                     | ✅ · QA visual                            |
| Pedidos                      | `/admin/pedidos` (+ `[id]`)  | ✅ · QA visual                            |
| Productos                    | `/admin/productos`           | ✅ · QA visual                            |
| Categorías                   | `/admin/categorias`          | ✅ · QA visual                            |
| Clientes                     | `/admin/clientes` (+ `[id]`) | ✅ · QA visual                            |
| Filamentos                   | `/admin/filamentos`          | ✅ · QA visual                            |
| Impresiones fallidas         | `/admin/fallas`              | ✅ · QA visual                            |
| Cola de impresión            | `/admin/produccion`          | ✅ · QA visual                            |
| Descuentos                   | `/admin/descuentos`          | ✅ · QA visual                            |
| Recompensas                  | `/admin/recompensas`         | ✅ · QA visual                            |
| Reportes                     | `/admin/reportes`            | ✅ · QA visual                            |
| Ganancias y socios           | `/admin/ganancias`           | ✅ · QA visual                            |
| Configuración                | `/admin/configuracion`       | ✅ · QA visual                            |
| Historial de cálculos        | `/admin/calculadora`         | ✅ · QA visual                            |
| Pedidos a medida             | `/admin/medida`              | 🟠 **Diverge (en construcción)** por flag |

## Divergencias conocidas (intencionales)

1. 🟠 **A medida (cliente y admin)**: hoy muestran `<UnderConstruction>`, no el
   diseño de chat del index. Es una **divergencia deliberada y temporal** (flag
   `CUSTOM_ORDERS_ENABLED=false`). Al reactivar el flag, vuelve el diseño del index.
2. **`/admin/pedidos/importar`**: placeholder "en construcción" que **no existe
   como pantalla real en el index** (es una función futura).
3. **Sección "Acciones" en el detalle de pedido** + spinners de carga en botones:
   son **agregados** de UX (borrado, loaders) que el index no mostraba; respetan
   el sistema de diseño (variant `danger`, `ui-card`) pero son nuevos.

## Recomendación de verificación (para cerrar el doc con certeza)

La paridad exacta necesita **QA visual**: correr `pnpm dev`, abrir cada ruta y
comparar contra la sección equivalente del `index.html` (idealmente con
screenshots lado a lado). Priorizar: Home, catálogo, producto, checkout y
dashboard admin (las de mayor tráfico). Este documento deja el **mapa** listo
para ese pase.

_Fin del Documento 12._
