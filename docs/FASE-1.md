# Hefesto 3D — Resumen de la Fase 1 (Catálogo público)

Este documento explica **qué construimos en la Fase 1**, **para qué sirve cada
cosa** y **cómo se conecta todo**. Está pensado para leerlo de arriba a abajo
sin asumir conocimiento previo del código.

> Resultado de la Fase 1: la tienda ya se navega de punta a punta con datos
> reales — **Home → Catálogo (con filtros) → Detalle de producto** — más SEO
> básico. Todavía **no** hay carrito, login ni panel de administración (eso es
> de fases siguientes).

---

## 1. La idea grande: capas y "hacia dónde apunta cada flecha"

El proyecto está organizado en **capas**, y las dependencias van **siempre
hacia abajo**. Esto es lo más importante de entender:

```
Página (app/)          ← lo que ve el usuario; solo arma y muestra
   │ llama a
Servicio (services/)   ← reglas de negocio; calcula cosas (precio, descuento…)
   │ llama a
Repositorio (repository.ts) ← ÚNICA puerta a la base de datos
   │ consulta
Base de datos (core/db) ← Postgres (Supabase) vía Drizzle
```

Reglas que respetamos siempre:

- La **UI nunca habla con la base directo**: pasa por el servicio, que pasa por
  el repositorio.
- La **lógica de negocio vive en los servicios**, nunca dentro de un componente.
- El **repositorio es el único** que arma consultas SQL.

¿Por qué? Porque así cada cosa tiene un solo lugar, se puede testear, y si el
día de mañana cambia la base o una regla, tocás un solo punto.

---

## 2. La base de datos (el catálogo)

### Las tablas (`src/core/db/schema/`)

Cada archivo define una tabla con Drizzle (nuestro ORM):

| Archivo               | Tabla                   | Para qué                                                                                                                 |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `enums.ts`            | `product_status`        | Estado del producto: `draft` (borrador), `published` (a la venta), `archived`                                            |
| `categories.ts`       | `categories`            | Categorías (nombre, `slug`, ícono, color, orden)                                                                         |
| `products.ts`         | `products`              | Productos (nombre, `slug`, descripción, precio, oferta, material, tiempo, peso, dimensiones, estado, destacado, nuevo)   |
| `product-images.ts`   | `product_images`        | Imágenes de cada producto (url, alt, orden, principal)                                                                   |
| `product-variants.ts` | `product_variants`      | **Tamaños** de un producto (ej. "Chica 12 cm"), con su precio                                                            |
| `tags.ts`             | `tags` + `product_tags` | Etiquetas y su relación N:N con productos                                                                                |
| `relations.ts`        | —                       | Le dice a Drizzle cómo se relacionan las tablas (para traer un producto con sus imágenes/variantes de una sola consulta) |
| `index.ts`            | —                       | Junta y reexporta todo el schema                                                                                         |

**Conceptos que aparecen en las tablas:**

- **`slug`**: la versión "linda para URL" del nombre. Ej.: _"Maceta geométrica"_
  → `maceta-geometrica` → `…/producto/maceta-geometrica`. Es único y bueno para
  SEO.
- **CHECK**: reglas que la base hace cumplir sí o sí. Ej.: `precio > 0`,
  `precio_oferta < precio`. Si intentás guardar algo inválido, la base lo
  rechaza.
- **FK (foreign key / clave foránea)**: une dos tablas. Ej.: una imagen
  pertenece a un producto. Con `on delete cascade`, si se borra el producto se
  borran sus imágenes; con `set null`, si se borra una categoría, sus productos
  quedan "sin categoría" en vez de borrarse.
- **Índices**: aceleran las búsquedas frecuentes (por `slug`, por estado, por
  categoría).

### Decisión de dominio clave: **productos a pedido, sin stock**

Tu negocio imprime **a pedido**, así que los productos **no tienen stock**. El
único inventario real es el **filamento por color (en gramos)**, que se modela
más adelante (Fase 7). Por eso sacamos la columna `stock` de `products` y de las
variantes.

### Migraciones (`src/core/db/migrations/`)

Una **migración** es un archivo SQL versionado que cambia la estructura de la
base. Drizzle las genera comparando tu schema con el estado anterior.

- `0000_…sql` → crea todas las tablas del catálogo.
- `0001_…sql` → elimina las columnas de `stock` (decisión "a pedido").
- `meta/` → metadatos internos de Drizzle (no se tocan a mano).

Se aplican con `pnpm db:migrate`.

### Datos de ejemplo (`seed`)

Para tener con qué trabajar mientras desarrollás:

- `seed-data.ts` → los datos (4 categorías, 9 productos, imágenes, tamaños, tags).
- `seed.ts` → la función que limpia y carga esos datos.
- `seed-run.ts` → el que se ejecuta con `pnpm db:seed`.

A propósito hay **1 producto en `draft`** (para probar que no aparece al
público) y **2 en oferta**.

### Conexión y configuración

- `core/db/index.ts` → el cliente Drizzle conectado a tu Supabase.
- `core/config/env.ts` → valida las variables de entorno con **Zod** al
  arrancar; si falta una, falla con un mensaje claro.
- `drizzle.config.ts` → configuración de las migraciones.

---

## 3. El feature `products` (la "trastienda" del catálogo)

Carpeta `src/features/products/`. Acá vive todo lo del dominio "productos".

| Archivo                      | Qué hace                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                   | Los **tipos** (Product, Category, etc.), **inferidos del schema** para que nunca se desincronicen. También los DTOs de vista (`ProductView`, `ProductDetailView`).                          |
| `schemas.ts`                 | Validación con **Zod** de los **filtros del catálogo** (categoría, material, precio, orden, paginación). Sanitiza lo que llega por la URL.                                                  |
| `repository.ts`              | **Acceso a datos** (solo lectura): `findPublished` (con filtros, orden y paginación), `findBySlug`, `findCategories`, `findRelated`, `findFeatured`, `findMaterials`, `findPublishedSlugs`. |
| `services/catalogService.ts` | **Reglas de negocio**: usa el repositorio y arma datos listos para la UI.                                                                                                                   |

### Qué calcula el `CatalogService` (para que la UI no haga cuentas)

- **Precio efectivo**: si hay oferta válida, usa ese; si no, el normal.
- **% de descuento** cuando está en oferta.
- **Imagen principal** (la marcada como tal, o la primera).
- **"Desde"**: marca si el producto tiene tamaños, para mostrar "desde $X".

Métodos del servicio: `listProducts` (catálogo paginado), `getProductBySlug`
(detalle o 404), `listCategories`, `listMaterials`, `getRelatedProducts`,
`getHomeData` (secciones de la Home), `listPublishedSlugs` (para el sitemap).

---

## 4. La interfaz (lo visual)

### Sistema de diseño

Los colores, tipografías y espaciados están definidos como **tokens** (variables
CSS) en `src/app/globals.css`, conectados a Tailwind. Hay 3 temas
(`dark`, `light`, `warm`). Por eso en las clases ves cosas como `bg-primary`,
`text-dim`, `bg-surface-1`: leen esos tokens y respetan el tema activo.

### Primitivos (`src/components/ui/`)

Las piezas base, reutilizables en todo el sitio:

- `button.tsx` → `Button` (variantes primary/secondary/outline/ghost/danger).
- `badge.tsx` → `Badge` (para "Oferta", "Nuevo", etc.).
- `card.tsx` → `Card` y sus partes.
- (`lib/utils.ts` → `cn()`, un ayudante para combinar clases de CSS.)

### Compartidos (`src/components/shared/`)

- `price-tag.tsx` → muestra el precio (normal, en oferta tachado, o "desde").
- `empty-state.tsx` → cartel de "no hay resultados".
- `pagination.tsx` → botones Anterior/Siguiente del catálogo.

### Layout del storefront (`src/components/layout/`)

- `header.tsx` → barra superior (logo + navegación).
- `footer.tsx` → pie de página.
- Se conectan en `app/(storefront)/layout.tsx`, que envuelve todas las páginas
  públicas con Header + contenido + Footer.

### Componentes de producto (`src/features/products/components/`)

- `product-card.tsx` → la **tarjeta** de un producto (imagen, badges, precio).
- `product-grid.tsx` → la **grilla** de tarjetas (o el estado vacío).
- `filter-panel.tsx` → el **formulario de filtros** del catálogo.
- `product-gallery.tsx` → la **galería** de imágenes del detalle.

### Formato (`src/lib/format.ts`)

- `formatPrice(3800)` → `"$3.800"` (pesos argentinos).
- `formatMinutes(180)` → `"3 h"` (tiempo de impresión).

---

## 5. Las páginas (`src/app/(storefront)/`)

| Ruta               | Archivo                    | Qué muestra                                                                                                                                     |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `page.tsx`                 | **Home**: hero, categorías, secciones Destacados/Novedades/Ofertas, "cómo funciona". Trae datos reales.                                         |
| `/catalogo`        | `catalogo/page.tsx`        | **Catálogo**: filtros, grilla y paginación. Los filtros viajan en la URL y se validan en el servidor.                                           |
| `/producto/[slug]` | `producto/[slug]/page.tsx` | **Detalle**: galería, precio, descripción, tamaños, especificaciones, nota de envío y relacionados. Da **404** si no existe o está en borrador. |

**Por qué dicen `export const dynamic = "force-dynamic"`:** estas páginas leen la
base en **cada visita** (renderizado en el servidor). Lo necesitan porque traen
datos que cambian; la optimización de caché se afina en la Fase 10.

---

## 6. SEO

- `app/layout.tsx` → metadata global (título, descripción, OpenGraph para
  compartir en redes).
- `app/sitemap.ts` → genera `/sitemap.xml` con Home, Catálogo y todos los
  productos publicados (para que Google los encuentre).
- `app/robots.ts` → genera `/robots.txt` (permite todo, bloquea `/admin`).
- `lib/site.ts` → la URL del sitio (`NEXT_PUBLIC_SITE_URL`, con fallback a
  localhost).

---

## 7. Decisiones importantes que tomamos

- **Productos a pedido (sin stock).** El inventario real es el filamento por
  color (Fase 7).
- **Variantes = tamaños** (con precio propio), no colores. El color saldrá del
  filamento más adelante.
- **Tailwind v4** (CSS-first): el tema vive en `globals.css`, sin
  `tailwind.config.ts`.
- **Primitivos a mano** en estilo shadcn (con `cva` + `cn`) usando **tus
  tokens**, en vez del CLI de shadcn (que traía sus propios colores).
- **`force-dynamic`** en las páginas que leen la base (evita problemas en el
  build/CI, que no tienen conexión a la base).
- **Session pooler** de Supabase en la `DATABASE_URL` (IPv4, confiable desde tu
  máquina).

---

## 8. Comandos útiles

```bash
cd D:\Hefesto\Hefesto\hefesto

pnpm dev            # levanta el sitio en http://localhost:3000
pnpm build          # compila para producción
pnpm lint           # revisa el código (ESLint)
pnpm format         # formatea el código (Prettier)

pnpm db:migrate     # aplica migraciones a la base
pnpm db:seed        # carga los datos de ejemplo
pnpm db:studio      # abre un visor de la base (Drizzle Studio)
```

Páginas para probar:

- `http://localhost:3000` → Home
- `http://localhost:3000/catalogo` → Catálogo (probá `?category=gaming`)
- `http://localhost:3000/producto/dragon-articulado` → Detalle (con tamaños)
- `http://localhost:3000/producto/llavero-personalizable` → debería dar **404**
- `http://localhost:3000/sitemap.xml` y `/robots.txt`

---

## 9. Qué sigue

**Fase 2 — Admin de catálogo** (Cap. 18, pasos 20-24): panel interno para crear
y editar productos (con imágenes) y categorías. Es la primera vez que vamos a
**escribir** en la base desde la app. La **autenticación** que protege ese panel
llega en la **Fase 3**.

---

_Documento generado al cierre de la Fase 1. La fuente de verdad de la
arquitectura sigue siendo `HEFESTO-Libro-Maestro.md`._
