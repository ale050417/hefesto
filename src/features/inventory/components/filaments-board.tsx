"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import { addSpoolAction, deleteFilamentAction } from "../actions";
import { filColor } from "../constants";
import type { FilamentView } from "../types";
import { FilamentForm } from "./filament-form";

type View = "grilla" | "lista";

const CARD_BADGE: Record<
  FilamentView["status"],
  { label: string; cls: string }
> = {
  ok: { label: "En stock", cls: "badge-success" },
  bajo: { label: "Stock bajo", cls: "badge-warning" },
  agotado: { label: "Agotado", cls: "badge-danger" },
};
const TABLE_BADGE: Record<
  FilamentView["status"],
  { label: string; cls: string }
> = {
  ok: { label: "En stock", cls: "badge-success" },
  bajo: { label: "Bajo", cls: "badge-warning" },
  agotado: { label: "Agotado", cls: "badge-danger" },
};

function stockLabel(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

const PlusIcon = (
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

export function FilamentsBoard({
  filaments,
  materials,
}: {
  filaments: FilamentView[];
  materials: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mat, setMat] = useState("all");
  const [view, setView] = useState<View>("grilla");
  const [editing, setEditing] = useState<FilamentView | null>(null);
  const [confirming, setConfirming] = useState<FilamentView | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filaments.filter((f) => {
      if (mat !== "all" && f.material !== mat) return false;
      if (q && !`${f.material}${f.color}${f.brand}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [filaments, search, mat]);

  async function addSpool(id: string) {
    setPendingId(id);
    const res = await addSpoolAction(id);
    setPendingId(null);
    if (res.ok) {
      toast("+1 carrete agregado", "success");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  async function confirmRemove(f: FilamentView) {
    const res = await deleteFilamentAction(f.id);
    if (!res.ok) throw new Error(res.error.message);
    toast("Filamento eliminado", "danger");
    router.refresh();
  }

  return (
    <>
      <div className="toolbar">
        <div className="search" style={{ width: 240 }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="input"
            placeholder="Buscar material, color, marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`chip ${mat === "all" ? "active" : ""}`}
          onClick={() => setMat("all")}
        >
          Todos
        </button>
        {materials.map((m) => (
          <button
            key={m}
            className={`chip ${mat === m ? "active" : ""}`}
            onClick={() => setMat(m)}
          >
            {m}
          </button>
        ))}
        <div className="grow" />
        <div className="mode-switch">
          <button
            className={view === "grilla" ? "active" : ""}
            onClick={() => setView("grilla")}
            title="Grilla"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            className={view === "lista" ? "active" : ""}
            onClick={() => setView("lista")}
            title="Lista"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-dim">No hay filamentos con estos filtros.</div>
        </div>
      ) : view === "grilla" ? (
        <div className="grid-3">
          {list.map((f) => {
            const b = CARD_BADGE[f.status];
            const pct = Math.min(
              (f.stockGrams / (f.spoolGrams * 3)) * 100,
              100,
            );
            const spools = f.spoolGrams ? f.stockGrams / f.spoolGrams : 0;
            const barColor =
              f.status === "agotado"
                ? "var(--danger)"
                : f.status === "bajo"
                  ? "var(--warning)"
                  : "linear-gradient(90deg,var(--gold-deep),var(--gold-bright))";
            return (
              <div
                key={f.id}
                className="ui-card card-hover cursor-pointer"
                style={{ padding: 0, overflow: "hidden" }}
                onClick={() => setEditing(f)}
              >
                <div style={{ height: 6, background: filColor(f.color) }} />
                <div style={{ padding: 18 }}>
                  <div className="mb-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="spool"
                        style={{ "--spc": filColor(f.color) } as CSSProperties}
                      >
                        <span />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold">
                          {f.material}
                        </div>
                        <div className="text-faint text-[12px]">
                          {f.color} · {f.brand}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-faint">Stock</span>
                    <b>{stockLabel(f.stockGrams)}</b>
                  </div>
                  <div className="progress" style={{ height: 7 }}>
                    <div
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                  <div className="text-faint mt-1.5 text-[11px]">
                    ≈ {spools.toFixed(1)} carrete(s) de {f.spoolGrams} g
                  </div>
                  <div className="mt-3.5 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-faint text-[12px]">
                      Costo {formatPrice(f.costPerKg)}/kg
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Sumar carrete"
                        disabled={pendingId === f.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          addSpool(f.id);
                        }}
                      >
                        {PlusIcon} Carrete
                      </button>
                      <button
                        className="btn-icon btn-ghost"
                        title="Editar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(f);
                        }}
                      >
                        {EditIcon}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ui-card">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl tbl-cards">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Color</th>
                  <th>Marca</th>
                  <th>Ø mm</th>
                  <th>Stock</th>
                  <th>Costo/kg</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((f) => {
                  const b = TABLE_BADGE[f.status];
                  return (
                    <tr key={f.id}>
                      <td data-label="Material">
                        <b>{f.material}</b>
                      </td>
                      <td data-label="Color">
                        <span className="flex items-center gap-2">
                          <span
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: "50%",
                              background: filColor(f.color),
                              border: "1px solid rgba(255,255,255,.25)",
                            }}
                          />
                          {f.color}
                        </span>
                      </td>
                      <td className="muted" data-label="Marca">
                        {f.brand}
                      </td>
                      <td className="muted" data-label="Ø mm">
                        {f.diameter}
                      </td>
                      <td data-label="Stock">
                        <b>{stockLabel(f.stockGrams)}</b>
                      </td>
                      <td className="price" data-label="Costo/kg">
                        {formatPrice(f.costPerKg)}
                      </td>
                      <td data-label="Estado">
                        <span className={`badge ${b.cls}`}>{b.label}</span>
                      </td>
                      <td data-label="">
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn-icon btn-ghost"
                            title="Sumar carrete"
                            disabled={pendingId === f.id}
                            onClick={() => addSpool(f.id)}
                          >
                            {PlusIcon}
                          </button>
                          <button
                            className="btn-icon btn-ghost"
                            title="Editar"
                            onClick={() => setEditing(f)}
                          >
                            {EditIcon}
                          </button>
                          <button
                            className="btn-icon btn-ghost"
                            title="Eliminar"
                            onClick={() => setConfirming(f)}
                          >
                            {TrashIcon}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.material} · ${editing.color}` : "Filamento"}
        size="lg"
      >
        {editing ? (
          <FilamentForm
            filament={{
              id: editing.id,
              material: editing.material,
              color: editing.color,
              brand: editing.brand,
              diameter: editing.diameter,
              stockGrams: editing.stockGrams,
              spoolGrams: editing.spoolGrams,
              costPerKg: editing.costPerKg,
              alertThresholdGrams: editing.alertThresholdGrams,
            }}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={
          confirming
            ? `¿Eliminar ${confirming.material} ${confirming.color}?`
            : "¿Eliminar filamento?"
        }
        onConfirm={() => {
          if (confirming) return confirmRemove(confirming);
        }}
      />
    </>
  );
}
