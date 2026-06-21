# Hefesto 3D — Resumen de la Fase 9 (Reportes)

Continúa donde terminó `FASE-8.md`. Explica **qué construimos**, **para qué** y
**cómo se conecta**.

> Resultado de la Fase 9: el dueño tiene **datos** — un **dashboard** con KPIs y
> gráfico de ingresos, y una sección de **reportes** (ventas por período, top
> productos, ingresos por categoría) con **export a CSV**. Todas las
> agregaciones se calculan en el **servidor (SQL)** y son solo para el admin.

---

## 1. ReportService — agregaciones SQL (Paso 59)

`features/reports/repository.ts` hace las agregaciones con SQL en la base:

- **KPIs**: ingresos y cantidad de ventas (estados de venta), pedidos pendientes
  de pago, filamentos bajo umbral.
- **Ingresos por día** (`getRevenueByDay`) para el gráfico.
- **Top productos** (`getTopProducts`) desde `order_items`.
- **Ingresos por categoría** (`getCategoryBreakdown`) uniendo ítems → productos
  → categorías.
- **Ventas para CSV** por rango de fechas.

> "Venta concretada" = estados `confirmed, in_production, ready, shipped,
delivered` (excluye pendientes y cancelados).

`service.ts` agrega **lógica pura testeable**: `fillDailySeries` (rellena días
sin ventas con 0 para una serie continua) y `buildSalesCsv` (genera el CSV con
escape de comillas). **Tests** cubren ambas. Las agregaciones se validaron en
pglite (6/6: KPIs, top, serie diaria y breakdown).

---

## 2. Dashboard (Paso 60)

`/admin` ahora es un **dashboard** (B1 del libro):

- Fila de **KPIs** (ingresos, ventas, pendientes, filamentos bajo stock).
- **Gráfico de ingresos** de 30 días (`RevenueChart`, SVG propio con degradé
  dorado — sin dependencias externas).
- **Últimos pedidos** y **alertas de stock bajo**.
- **Accesos rápidos** a las secciones.

---

## 3. Reportes + CSV (Paso 61)

`/admin/reportes`:

- **Rango** 7 / 30 / 90 días (en la URL).
- Gráfico de ingresos del período.
- **Top productos** (tabla) e **ingresos por categoría** (barras).
- Botón **Exportar CSV** (acción server con guard `isStaff`; el navegador baja
  el archivo).

Link **Reportes** en el sidebar. Todo con el diseño del demo (page-head, cards,
tablas `.tbl`, chips de rango).

---

## 4. Control + relevamiento (cierre de fase)

- **Control:** typecheck ✅ · lint ✅ · format ✅ · **61 tests** ✅ · build ✅ ·
  agregaciones validadas en pglite (6/6). Sin migración (solo lecturas).
- **Relevamiento:** reglas de dependencias OK (reports usa los **services** de
  orders/inventory, no sus repositories); export con guard de staff; sin deudas
  nuevas.

---

## 5. Cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm dev
```

- Entrá al panel (`/admin`) → vas a ver los KPIs y el gráfico (con datos si ya
  hay pedidos confirmados).
- `/admin/reportes` → cambiá el rango, mirá top productos y categorías, y
  **Exportar CSV**.

---

## 6. Qué sigue

**Fase 10 — Deploy / hardening** (producción en Vercel, dominio, MercadoPago
real, y los hallazgos pendientes del relevamiento: RLS de `business_settings`,
ampliar E2E, auditoría de productos/categorías).

---

_Documento generado al cierre de la Fase 9. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
