# Hefesto 3D — Resumen de la Fase 2 (Admin de catálogo + Integridad)

Este documento explica **qué construimos en la Fase 2**, **para qué sirve cada
cosa** y **cómo se conecta todo**. Continúa donde terminó `FASE-1.md`.

> Resultado de la Fase 2: hay un **panel de administración** para gestionar el
> catálogo de punta a punta (crear/editar/publicar productos, subir imágenes,
> y administrar categorías), montado sobre una base de datos con **integridad
> blindada**.
>
> ⚠️ **Importante:** el panel `/admin` todavía está **SIN protección** (sin
> login). Eso se cierra en la **Fase 3**. En local no hay problema; no lo
> publiques abierto.

---

## 1. El panel de administración (el "marco")

Gracias a los _route groups_ de Next, la tienda y el admin tienen **layouts
distintos** aunque compartan el mismo proyecto:

- `app/(storefront)/` → la tienda pública (Header + Footer).
- `app/(admin)/admin/` → el panel (barra lateral, sin header/footer públicos).

| Archivo                         | Para qué                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `components/layout/sidebar.tsx` | Barra lateral con la navegación del admin (Panel, Productos, Categorías) |
| `app/(admin)/admin/layout.tsx`  | El marco del panel: sidebar + área de contenido                          |
| `app/(admin)/admin/page.tsx`    | Home del panel con accesos a Productos y Categorías                      |

---

## 2. La capa que ESCRIBE en la base (lo nuevo de la Fase 2)

En la Fase 1 todo era **lectura**. Acá agregamos **escritura**, siempre por el
mismo recorrido (Cap. 11 del libro):

```
UI (form) → action (valida con Zod) → service (reglas) → repository → base
```

La regla de oro: **la validación y las reglas viven en el servidor**, nunca se
confía en el navegador.

### Productos

| Archivo                                        | Qué agregó                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/products/schemas.ts`                 | `productInputSchema` (Zod): valida alta/edición — nombre, slug, precio > 0, oferta < precio, **categoría obligatoria**                          |
| `features/products/repository.ts`              | Escrituras: `insertProduct`, `updateProductRow`, `setProductStatus`, `findProductById`, `countImages`                                           |
| `features/products/services/catalogService.ts` | `createProduct` (nace en `draft`), `updateProduct`, `publishProduct` (**bloquea si no tiene imágenes**), `archiveProduct`                       |
| `features/products/actions.ts`                 | `createProductAction`, `updateProductAction`, `publishProductAction`, `archiveProductAction` — devuelven `{ ok, ... }` y manejan slug duplicado |

**Estados de un producto:** nace como **borrador** (`draft`); pasar a
**publicado** (`published`) es una acción aparte con su regla; **archivar**
(`archived`) es el "borrado lógico" (no se elimina, se oculta).

---

## 3. Imágenes: subida + optimización automática

Cuando subís una imagen desde el admin, el servidor la **procesa y optimiza**
antes de guardarla.

| Archivo                                        | Qué hace                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `core/supabase/admin.ts`                       | Cliente de Supabase con la **secret key** (solo servidor) para subir a Storage                                   |
| `core/storage/index.ts`                        | `optimizeImage` (redimensiona a máx. 1600 px + convierte a **WebP** con `sharp`), `uploadObject`, `deleteObject` |
| `features/products/repository.ts`              | `insertImage`, `listImagesByProduct`, `findImageById`, `deleteImageRow`, `setPrimaryImage`                       |
| `features/products/services/catalogService.ts` | `addProductImage` (procesa → sube → registra), `removeProductImage`, `makeImagePrimary`                          |
| `features/products/actions.ts`                 | `uploadProductImageAction`, `deleteProductImageAction`, `setPrimaryImageAction` (validan tipo y tamaño)          |

**El flujo de una imagen:** elegís un archivo → el server valida (JPG/PNG/WebP,
máx 8 MB) → `sharp` la achica y la pasa a WebP → se sube al bucket **`products`**
de Supabase Storage → se guarda su URL en `product_images`.

> Dato: `next/image` además sirve las imágenes optimizadas por dispositivo. O
> sea: guardamos liviano **y** se entrega liviano.

---

## 4. El formulario en pantalla

| Archivo                                                   | Qué es                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `features/products/components/product-form.tsx`           | Formulario de alta/edición (React Hook Form). Muestra errores por campo (vienen validados del servidor). Botón "Generar" slug |
| `features/products/components/image-upload.tsx`           | Subir imágenes, elegir la **principal**, borrar                                                                               |
| `features/products/components/product-status-actions.tsx` | Botones **Publicar** / **Archivar**                                                                                           |
| `app/(admin)/admin/productos/nuevo/page.tsx`              | Crear producto (avisa si todavía no hay categorías)                                                                           |
| `app/(admin)/admin/productos/[id]/editar/page.tsx`        | Editar: datos + imágenes + estado                                                                                             |

**Cómo valida:** el form usa React Hook Form para el estado, pero **quien decide
si los datos son válidos es el servidor** (la action corre `productInputSchema`
de Zod y devuelve los errores, que el form muestra en cada campo).

---

## 5. Lista de productos

`app/(admin)/admin/productos/page.tsx` — la tabla con **todos** los productos
(borradores, publicados y archivados, no solo los públicos):

- Imagen, nombre, categoría, precio y **estado** (badge).
- **Buscador** por nombre + **filtro por estado** (en la URL).
- Botón "Nuevo producto", link "Editar" y **paginación**.

Apoyada en `repository.findAllForAdmin` y `service.listProductsAdmin`.

---

## 6. CRUD de categorías

| Archivo                                                   | Qué es                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `features/products/schemas.ts`                            | `categoryInputSchema` (nombre, slug, ícono, color hex, orden)                                                                        |
| `features/products/repository.ts`                         | `insertCategory`, `updateCategoryRow`, `deleteCategoryRow`, `findCategoryById`, `countProductsInCategory`, `listCategoriesWithCount` |
| `features/products/services/catalogService.ts`            | `createCategory`, `updateCategory`, `deleteCategory` (**bloquea si tiene productos**), `getCategoryAdmin`, `listCategoriesAdmin`     |
| `features/products/actions.ts`                            | `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`                                                               |
| `features/products/components/category-form.tsx`          | Form de alta/edición                                                                                                                 |
| `features/products/components/delete-category-button.tsx` | Borrar (deshabilitado si la categoría tiene productos)                                                                               |
| `app/(admin)/admin/categorias/{page, nueva, [id]/editar}` | Lista (con conteo), crear y editar                                                                                                   |

---

## 7. 🛡️ Integridad de datos (la parte más importante)

Hicimos una **auditoría de integridad** del esquema y la migración **`0002`**
para que la base **no permita datos rotos**, hoy ni el día de mañana.

### Reglas de negocio nuevas (decididas por vos, desviándonos del libro)

El Libro Maestro original permitía productos **sin** categoría y borrar
categorías dejando productos huérfanos. Lo cambiamos a algo más estricto y
**actualizamos el Libro Maestro** (Cap. 8, 10 y 11) para que siga siendo la
única fuente de verdad:

- **Todo producto debe tener categoría** → `products.category_id` es **NOT NULL**.
- **No se puede borrar una categoría con productos** → FK **`on delete restrict`**
  - chequeo en el servicio con mensaje claro.

### Constraints que agrega la migración `0002`

| Regla                                            | Qué impide                                       |
| ------------------------------------------------ | ------------------------------------------------ |
| `category_id` NOT NULL + FK `restrict`           | Producto sin categoría / borrar categoría en uso |
| `categories.name` único                          | Dos categorías con el mismo nombre               |
| `sale_price` CHECK (`>0` y `<price`)             | Oferta inválida (≥ precio o ≤ 0)                 |
| `print_time_minutes` / `weight_grams` CHECK `≥0` | Valores negativos                                |
| `product_variants.price_override` CHECK `>0`     | Precio de tamaño inválido                        |
| `UNIQUE(product_id, label)` en variantes         | Dos tamaños iguales en un producto               |
| Índice único parcial en `product_images`         | Más de una imagen **principal** por producto     |
| Índices en las FK (`product_id`)                 | (rendimiento de las consultas)                   |

> Cada una de estas reglas se probó contra un Postgres real: **rechaza** los
> datos inválidos y **acepta** los válidos.

**Defensa en profundidad:** muchas reglas viven en **dos capas** — el servidor
(mensaje lindo para el usuario) **y** la base de datos (a prueba de balas,
aunque algo intente saltearse la app).

---

## 8. Decisiones de la Fase 2

- **Storage:** las imágenes se suben **desde el servidor** con la secret key
  (nunca desde el navegador). Bucket `products` público para lectura.
- **WebP + resize** con `sharp` al subir (ahorra espacio; `next/image` además
  optimiza al entregar).
- **Validación en el servidor** como fuente de verdad; el form solo muestra los
  errores que devuelve la action.
- **Integridad en dos capas** (servicio + base), con desviaciones del libro
  **registradas en el propio libro**.

---

## 9. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm dev            # http://localhost:3000

# Si cambió el esquema (integridad):
pnpm db:seed        # reseed con categorías (deja todo consistente)
pnpm db:migrate     # aplica la migración 0002
```

Para probar el admin:

- `http://localhost:3000/admin` → panel
- `http://localhost:3000/admin/productos` → lista (buscar / filtrar)
- `http://localhost:3000/admin/productos/nuevo` → crear + subir imagen + publicar
- `http://localhost:3000/admin/categorias` → crear, editar, borrar (borrar está
  bloqueado si la categoría tiene productos)

---

## 10. Qué sigue

**Fase 3 — Autenticación** (Cap. 18, pasos 25–30): Supabase Auth, perfiles +
roles, login/registro/recuperación, **proteger `/admin/*`** (cerrar el panel que
hoy está abierto) y RLS inicial.

---

_Documento generado al cierre de la Fase 2. La fuente de verdad de la
arquitectura sigue siendo `HEFESTO-Libro-Maestro.md`._
