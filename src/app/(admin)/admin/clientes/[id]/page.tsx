import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/core/auth/permissions";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { getAdminCustomer } from "@/features/customers/service";
import { TIER_LABEL } from "@/features/customers/tier";
import { CustomerNoteForm } from "@/features/customers/components/customer-note-form";
import { EditarClienteButton } from "@/features/customers/components/editar-cliente-button";
import { formatPrice } from "@/lib/format";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

const sinceFmt = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});
const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function SpecRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="spec-row">
      <span className="k flex items-center gap-2">
        {icon} {label}
      </span>
      <span className="v">{value}</span>
    </div>
  );
}

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionPage("clientes", "ver");
  const { id } = await params;
  // Id que no es UUID → 404 directo (sin query que reviente el panel).
  if (!isUuid(id)) notFound();
  const data = await getAdminCustomer(id);
  if (!data) notFound();
  const { customer, orders, points } = data;
  const firstName = customer.name.split(" ")[0] ?? customer.name;

  return (
    <div className="view grid gap-5">
      <Link href="/admin/clientes" className="text-dim hover:text-fg text-sm">
        ← Volver a clientes
      </Link>

      <div className="page-head">
        <div className="flex items-center gap-3">
          <span
            className="avatar flex-shrink-0"
            style={{ width: 44, height: 44, fontSize: 17 }}
          >
            {(customer.name[0] ?? "?").toUpperCase()}
          </span>
          <div>
            <h1 className="page-title">{customer.name}</h1>
            <div className="page-sub">
              {TIER_LABEL[customer.tier]} · desde{" "}
              {sinceFmt.format(customer.since)}
            </div>
          </div>
        </div>
        {customer.source === "manual" ? (
          <EditarClienteButton
            customer={{
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              city: customer.city,
              note: customer.note,
            }}
          />
        ) : null}
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="ui-card text-center" style={{ padding: 14 }}>
          <div className="kpi-val" style={{ fontSize: 24 }}>
            {customer.orders}
          </div>
          <div className="text-faint text-[12px]">pedidos</div>
        </div>
        <div className="ui-card text-center" style={{ padding: 14 }}>
          <div
            className="kpi-val"
            style={{ fontSize: 24, color: "var(--gold-bright)" }}
          >
            {formatPrice(customer.spent)}
          </div>
          <div className="text-faint text-[12px]">total gastado</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SpecRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={15}
              height={15}
              aria-hidden
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
          }
          label="Email"
          value={customer.email ?? "—"}
        />
        <SpecRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={15}
              height={15}
              aria-hidden
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }
          label="Teléfono"
          value={customer.phone ?? "—"}
        />
        <SpecRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={15}
              height={15}
              aria-hidden
            >
              <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
            </svg>
          }
          label="Ciudad"
          value={customer.city ?? "—"}
        />
      </div>

      <div>
        <div className="eyebrow mb-2.5">Historial de pedidos</div>
        {orders.length === 0 ? (
          <div className="text-faint text-[13px]">
            {customer.source === "manual"
              ? "Los clientes manuales no tienen pedidos del sistema asociados."
              : "Sin pedidos aún."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos/${o.id}`}
                className="ui-card flex items-center justify-between"
                style={{ padding: "11px 13px" }}
              >
                <div>
                  <b className="text-[13px]">{o.orderNumber}</b>
                  <div className="text-faint text-[11.5px]">
                    {dateFmt.format(o.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                  <b className="text-fg">{formatPrice(Number(o.total))}</b>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {customer.source === "registered" ? (
        <div
          className="ui-card"
          style={{
            padding: 16,
            background:
              "linear-gradient(150deg, rgba(var(--gold-rgb),.08), transparent)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className="flex items-center gap-2 font-semibold"
              style={{ color: "var(--gold-bright)" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width={16}
                height={16}
                aria-hidden
              >
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
              </svg>
              Puntos Hefesto
            </span>
            <div className="text-right">
              <b
                className="font-display text-[20px]"
                style={{ color: "var(--gold-bright)" }}
              >
                {points.balance}
              </b>{" "}
              <span className="text-faint text-[11.5px]">pts</span>
            </div>
          </div>
          <div className="text-faint text-[11.5px]">
            {points.earned} acumulados · {points.redeemed} canjeados
          </div>
          {points.redemptions.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-2.5">
              <div className="text-faint text-[10.5px] tracking-[0.1em] uppercase">
                Canjes realizados
              </div>
              {points.redemptions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-[12.5px]"
                >
                  <span className="flex items-center gap-2">
                    <span style={{ color: "var(--gold-bright)" }}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        width={14}
                        height={14}
                        aria-hidden
                      >
                        <rect x="3" y="8" width="18" height="4" rx="1" />
                        <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
                      </svg>
                    </span>
                    {r.reason}
                  </span>
                  <span
                    className="font-display"
                    style={{ color: "var(--gold-bright)" }}
                  >
                    −{r.points} pts
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <CustomerNoteForm
        id={customer.id}
        source={customer.source}
        note={customer.note}
      />

      {customer.phone ? (
        <a
          className="btn btn-secondary"
          href={waLink(
            customer.phone,
            `¡Hola ${firstName}! Te escribimos de Hefesto 3D.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
          </svg>
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
