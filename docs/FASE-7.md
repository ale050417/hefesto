# Hefesto 3D — Resumen de la Fase 7 (Inventario: filamentos + fallas)

Continúa donde terminó `FASE-6.md`. Explica **qué construimos**, **para qué** y
**cómo se conecta**.

> Resultado de la Fase 7: el dueño controla el **filamento** (su materia prima)
> por material/color en **gramos**, y registra **fallas de impresión** que
> **descuentan stock automáticamente** y **avisan** cuando un filamento queda
> bajo el umbral.

> Recordá el dominio: los **productos son a pedido (no tienen stock)**; el stock
> real de Hefesto es el **filamento por color**.

---

## 1. La base de datos (migración 0010)

- **`filaments`** — `material`, `color`, `stock_grams` (CHECK ≥ 0),
  `alert_threshold_grams`.
- **`print_failures`** — `filament_id` (FK, se pone null si se borra el
  filamento), `piece_name`, **snapshot** de `material`/`color`, `grams_lost`
  (CHECK > 0), `reason`, `notes`, `deducted`.
- **RLS**: ambas tablas las lee **solo el staff** (admin/operador). La escritura
  pasa por el servidor.

> Verificado contra Postgres real (pglite): los CHECK rechazan stock negativo y
> gramos ≤ 0, y el staff ve el inventario mientras un cliente no.

---

## 2. InventoryService (lógica) — Paso 53

Lógica **pura y testeada** (Cap. 15, porque toca stock):

- **`computeNewStock(actual, gramos)`** — descuenta y **nunca baja de 0**.
- **`isLowStock(stock, umbral)`** — marca alerta en o por debajo del umbral.
- **`registerFailure(...)`** — si la falla está marcada para descontar, baja los
  gramos del filamento, **avisa si quedó bajo el umbral**, guarda snapshot de
  material/color, y persiste **falla + descuento en una sola transacción**.

**7 tests** cubren: descuento normal, tope en 0, alerta de umbral, falla sin
descuento, y filamento inexistente.

---

## 3. Pantallas del panel — Paso 54

- **`/admin/filamentos`** — tabla con stock, umbral y **badge "Bajo stock"**;
  alta y edición de filamentos.
- **`/admin/fallas`** — formulario para registrar una falla (elegís filamento,
  pieza, gramos, causa, notas y si descuenta) + lista de fallas. Si el filamento
  queda bajo stock, te avisa en pantalla.

Las fallas quedan registradas en la **auditoría** (`audit_log`). Links
**Filamentos** y **Fallas** en el sidebar. Todo con el diseño del demo
(`page-head`, tablas `.tbl`, badges).

---

## 4. Cómo se conecta (capas)

```
Página/Form → action (isStaff + Zod + audit) → queries (orquesta)
   → service (regla pura) + repository (transacción a la base)
```

La regla de stock vive en el **service** (pura, testeable); la transacción
(insertar falla + descontar) en el **repository**; la autorización y validación
en la **action**.

---

## 5. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm db:migrate     # aplica 0010 (filaments, print_failures, RLS)
pnpm dev
```

- `/admin/filamentos` → cargá un filamento (ej. PLA / Negro / 1000 g / umbral 200).
- `/admin/fallas` → registrá una falla de 850 g sobre ese filamento → el stock
  baja a 150 g y aparece la alerta de bajo stock; la falla queda en la lista y
  en `/admin/auditoria`.

---

## 6. Qué sigue

**Fase 8 — Cupones / descuentos** (validación de cupón, % vs fijo, vigencia y
tope de uso). Luego **Fase 9 (reportes)** y **Fase 10 (deploy)**.

---

_Documento generado al cierre de la Fase 7. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
