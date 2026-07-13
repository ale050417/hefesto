"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { transitionOrderAction } from "@/features/orders/actions";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import type { OrderStatus } from "@/features/orders/types";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import { runAction } from "@/lib/run-action";

export type KanbanOrder = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  total: number;
  status: OrderStatus;
  createdAt: Date | string;
};

// Flujo de producción: son los estados reales del pedido (state machine).
const COLUMNS: { status: OrderStatus; color: string }[] = [
  { status: "confirmed", color: "#3a72c4" },
  { status: "in_production", color: "var(--gold)" },
  { status: "ready", color: "var(--gold-bright)" },
  { status: "shipped", color: "#3a72c4" },
  { status: "delivered", color: "var(--success)" },
];

function since(d: Date | string): { text: string; hours: number } {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return { text: "recién", hours: 0 };
  if (h < 24) return { text: `hace ${h} h`, hours: h };
  return { text: `hace ${Math.floor(h / 24)} d`, hours: h };
}

export function OrdersKanban({ orders }: { orders: KanbanOrder[] }) {
  const router = useRouter();
  const [over, setOver] = useState<OrderStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  async function move(id: string, status: OrderStatus) {
    const cur = orders.find((o) => o.id === id);
    if (!cur || cur.status === status) return;
    const res = await runAction(() => transitionOrderAction(id, status), {
      silent: true,
    });
    if (!res.ok) {
      toast(res.error.message, "danger");
      return;
    }
    toast(`Pedido → ${ORDER_STATUS_LABEL[status]}`, "success");
    router.refresh();
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = orders.filter((o) => o.status === col.status);
        const active = over === col.status;
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.status);
            }}
            onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain") || dragId;
              if (id) void move(id, col.status);
              setDragId(null);
            }}
            className="ui-card section-card flex-shrink-0"
            style={{
              width: 250,
              padding: 12,
              background: active ? "rgba(var(--gold-rgb),.07)" : undefined,
              borderColor: active ? "var(--gold)" : undefined,
            }}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: col.color,
                }}
              />
              <b className="text-[13px]">{ORDER_STATUS_LABEL[col.status]}</b>
              <span className="text-faint ml-auto text-[12px]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2" style={{ minHeight: 44 }}>
              {items.map((o) => {
                const s = since(o.createdAt);
                const late =
                  (col.status === "confirmed" ||
                    col.status === "in_production") &&
                  s.hours >= 48;
                return (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", o.id);
                      setDragId(o.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className="ui-card"
                    style={{
                      padding: "9px 11px",
                      cursor: "grab",
                      opacity: dragId === o.id ? 0.5 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13px]">{o.orderNumber}</b>
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        prefetch={false}
                        className="flex-shrink-0 text-[11px]"
                        style={{ color: "var(--gold-bright)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver
                      </Link>
                    </div>
                    <div className="text-faint truncate text-[12px]">
                      {o.customerName ?? "Cliente"}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-semibold">
                        {formatPrice(o.total)}
                      </span>
                      <span
                        style={{ color: late ? "var(--danger)" : "var(--dim)" }}
                      >
                        {late ? "⚠ " : ""}
                        {s.text}
                      </span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 ? (
                <div className="text-faint rounded-md border border-dashed border-[var(--border)] py-3 text-center text-[11.5px]">
                  Soltá un pedido acá
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
