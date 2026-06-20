# Hefesto 3D — Resumen de la Fase 5 (Gestión de pedidos + emails)

Continúa donde terminó `FASE-3.md` / `FASE-4.md`. Explica **qué construimos**,
**para qué** y **cómo se conecta**.

> Resultado de la Fase 5: el dueño ahora **gestiona** lo que se vendió. Hay un
> panel de pedidos (lista + detalle), una **máquina de estados**, manejo de
> tracking/notas/cancelaciones, **emails automáticos** en cada cambio y una
> **auditoría** de acciones sensibles. El loop del negocio quedó cerrado:
> **vendés y gestionás**.

---

## 1. Panel de pedidos (lista) — Paso 41

`/admin/pedidos` muestra todos los pedidos (el admin ve todo; las políticas RLS
son la red final, pero la app entra con Drizzle que las saltea).

- **Chips de estado** con conteo (Todos, Pendiente de pago, Pago confirmado, En
  producción, Listo, Enviado, Entregado, Cancelado, Reembolsado).
- **Tabla** con número, cliente, fecha, método de pago, estado (badge) y total.
- Paginación y link al detalle.

Capa: `repository.findOrdersForAdmin` (filtro + paginación + join al cliente) →
`service.listOrdersAdmin` (DTO de vista) → página.

---

## 2. Detalle del pedido + historial — Paso 42

`/admin/pedidos/[id]`: el pedido completo, leído de la base.

- Resumen (ítems con snapshots, totales, pago, envío).
- Datos del cliente.
- **Línea de tiempo** del historial de estados.

Capa: `repository.findOrderDetailForAdmin` (ítems + historial + cliente) →
`service.getOrderAdmin`.

---

## 3. Máquina de estados — Paso 43

`features/orders/transitions.ts` define **qué transiciones son válidas**:

```
pending_payment → confirmed → in_production → ready → shipped → delivered
        ↘ cancelled                                   ↘ refunded
```

`cancelled` y `refunded` son **terminales**. `transitionOrderStatus` valida la
transición (si es inválida lanza `InvalidTransitionError`) y registra el cambio
en el historial. **Probado con tests unitarios** (flujo normal, saltos
inválidos, estados terminales, no encontrado).

> La máquina de estados vive en un módulo **puro** (sin base de datos) para que
> también la pueda usar la UI del panel sin arrastrar dependencias del servidor.

---

## 4. Tracking / notas / cancelar / reembolsar — Paso 44

En el detalle, un panel **"Gestión"** con:

- Botones que muestran **solo las transiciones válidas** según el estado actual
  (cancelar/reembolsar en rojo).
- Campos de **código de seguimiento** y **nota interna**.
- Regla de negocio: **no se puede marcar "Enviado" sin cargar el seguimiento**.

Todo con guard `isStaff` y validación en el servidor.

---

## 5. Emails con Resend — Pasos 45 y 46

- **`core/email`**: adapter sobre Resend (`sendEmail`). Si no hay
  `RESEND_API_KEY`, el envío se omite con un aviso (no rompe en desarrollo).
- **`orderEmails`**: plantilla HTML (negro/dorado) + `notifyOrderStatus`.
- Se envía un email al cliente en **cada cambio de estado** y cuando el
  **webhook de MercadoPago confirma el pago**. Es "best-effort": si falla el
  mail, la operación no se rompe.

Variables nuevas (opcionales): `RESEND_API_KEY`, `RESEND_FROM`.

---

## 6. Auditoría — Paso 47

Migración **`0008`**: tabla **`audit_log`** (`actor_id`, `action`,
`entity_type`, `entity_id`, `metadata`, `created_at`) con **RLS** (solo el admin
puede leerla; nadie escribe desde la API pública).

- `core/audit.recordAudit` registra acciones sensibles (best-effort).
- Conectado a los cambios de estado y a la edición de tracking/nota de pedidos.
- Página **`/admin/auditoria`**: quién hizo qué y cuándo.

---

## 7. Diseño

Todo el panel se alineó al **demo de referencia** (`index.html`): `page-head`
con título grande, chips de filtro, tablas `.tbl`, badges de estado y la línea
de tiempo. El tema por defecto es claro.

---

## 8. Comandos y cómo probar

```bash
cd D:\Hefesto\Hefesto\hefesto
pnpm install        # baja resend
pnpm db:migrate     # aplica 0008 (audit_log)
pnpm dev
```

- `/admin/pedidos` → lista con chips y tabla.
- Entrá a un pedido → cambiá estados, cargá seguimiento, mirá el historial.
- Sin `RESEND_API_KEY`: el email se omite (lo ves en la consola). Con la key y un
  pedido cuyo cliente sea tu propio email de Resend, el mail llega.
- `/admin/auditoria` → registro de acciones.

---

## 9. Qué sigue

**Fase 6 — Cuenta del cliente** (Cap. 18, pasos 48–51): "Mis pedidos" con
seguimiento, perfil + direcciones, wishlist y RLS. Cierra el MVP (Fases 0–6).

---

_Documento generado al cierre de la Fase 5. La fuente de verdad sigue siendo
`HEFESTO-Libro-Maestro.md`._
