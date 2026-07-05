"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { compactPrice } from "@/lib/format";
import type { Coupon } from "../types";
import { deleteCouponAction } from "../actions";
import { CouponForm, type CouponFormData } from "./coupon-form";

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});

const GiftIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);
const EditIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);

type Status = { label: string; cls: string; faded: boolean };

function couponStatus(c: Coupon): Status {
  const expired = c.expiresAt != null && new Date(c.expiresAt) < new Date();
  if (expired) return { label: "Expirado", cls: "badge-neutral", faded: true };
  if (!c.isActive)
    return { label: "Pausado", cls: "badge-neutral", faded: true };
  return { label: "Activo", cls: "badge-success", faded: false };
}

export function CouponsAdmin({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CouponFormData | null>(null);
  const [confirming, setConfirming] = useState<Coupon | null>(null);

  const activos = coupons.filter(
    (c) => couponStatus(c).label === "Activo",
  ).length;
  const usos = coupons.reduce((a, c) => a + c.usedCount, 0);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Coupon) {
    setEditing({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: Number(c.value),
      minPurchase: Number(c.minPurchase),
      maxUses: c.maxUses,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString() : null,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      isActive: c.isActive,
    });
    setOpen(true);
  }

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Crecimiento</div>
          <h1 className="page-title">Descuentos</h1>
          <div className="page-sub">
            {activos} cupones activos · {usos} usos totales
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Crear cupón
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-dim">Todavía no creaste cupones.</div>
        </div>
      ) : (
        <div className="grid-2">
          {coupons.map((c) => {
            const st = couponStatus(c);
            const value = Number(c.value);
            const pct = c.maxUses
              ? Math.min((c.usedCount / c.maxUses) * 100, 100)
              : 0;
            return (
              <div
                key={c.id}
                className="ui-card card-hover"
                style={{ padding: 0, overflow: "hidden" }}
              >
                <div
                  className="flex"
                  style={{ borderBottom: "1px dashed var(--border)" }}
                >
                  <div style={{ padding: "18px 20px", flex: 1 }}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className="kpi-ic"
                        style={{
                          width: 34,
                          height: 34,
                          opacity: st.faded ? 0.5 : 1,
                        }}
                      >
                        {GiftIcon}
                      </div>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </div>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 21,
                        letterSpacing: ".04em",
                        color: "var(--gold-bright)",
                      }}
                    >
                      {c.code}
                    </div>
                    <div className="text-faint mt-1 text-[12.5px]">
                      {c.description ?? "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "18px 24px",
                      textAlign: "center",
                      borderLeft: "1px dashed var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <div className="font-display" style={{ fontSize: 30 }}>
                      {c.type === "percentage"
                        ? `${value}%`
                        : compactPrice(value)}
                    </div>
                    <div className="text-faint text-[10.5px] tracking-[0.1em] uppercase">
                      {c.type === "percentage" ? "descuento" : "fijo"}
                    </div>
                  </div>
                </div>
                <div
                  className="flex items-center justify-between text-[12.5px]"
                  style={{ padding: "13px 20px" }}
                >
                  <span className="muted">
                    vence{" "}
                    {c.expiresAt ? dateFmt.format(new Date(c.expiresAt)) : "—"}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-faint">
                      {c.usedCount}
                      {c.maxUses ? `/${c.maxUses}` : ""} usos
                    </span>
                    <button
                      className="btn-icon btn-ghost"
                      title="Editar"
                      onClick={() => openEdit(c)}
                    >
                      {EditIcon}
                    </button>
                    <button
                      className="btn-icon btn-ghost text-danger"
                      title="Eliminar"
                      onClick={() => setConfirming(c)}
                    >
                      {TrashIcon}
                    </button>
                  </span>
                </div>
                {c.maxUses ? (
                  <div
                    className="progress"
                    style={{ borderRadius: 0, height: 4 }}
                  >
                    <div style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar cupón" : "Crear cupón"}
        size="lg"
      >
        <CouponForm
          coupon={editing ?? undefined}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={
          confirming
            ? `¿Eliminar el cupón ${confirming.code}?`
            : "¿Eliminar cupón?"
        }
        detail="Se eliminará también su historial de canjes."
        onConfirm={async () => {
          if (!confirming) return;
          const res = await deleteCouponAction(confirming.id);
          if (!res.ok) throw new Error(res.error.message);
          toast("Cupón eliminado", "danger");
          router.refresh();
        }}
      />
    </div>
  );
}
