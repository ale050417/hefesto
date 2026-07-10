"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import {
  createProfitShareAction,
  deleteProfitShareAction,
  updateProfitShareAction,
} from "../actions";
import { GN_COLORS } from "../constants";

type Row = {
  key: string;
  id?: string;
  name: string;
  role: string;
  pct: string;
};

let tmp = 0;
const newKey = () => `tmp-${tmp++}`;

export function ProfitSharesEditor({
  shares,
  profit,
  canEdit = true,
}: {
  shares: Array<{ id: string; name: string; role: string | null; pct: string }>;
  profit: number;
  /** Si es false, se muestra read-only (sin guardar/agregar/quitar). */
  canEdit?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(
    shares.map((s) => ({
      key: s.id,
      id: s.id,
      name: s.name,
      role: s.role ?? "",
      pct: String(Number(s.pct)),
    })),
  );
  const [busy, setBusy] = useState(false);

  const total = rows.reduce((a, r) => a + (Number(r.pct) || 0), 0);
  const balanced = Math.round(total) === 100;

  const set = (key: string, field: keyof Row, value: string) =>
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );

  function addRow() {
    setRows((rs) => [...rs, { key: newKey(), name: "", role: "", pct: "0" }]);
  }
  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }
  function balance() {
    if (rows.length === 0) return;
    const each = Math.floor((100 / rows.length) * 100) / 100;
    setRows((rs) =>
      rs.map((r, i) => ({
        ...r,
        pct: String(
          i === rs.length - 1
            ? Math.round((100 - each * (rs.length - 1)) * 100) / 100
            : each,
        ),
      })),
    );
  }

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const localIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
      const removed = shares.filter((s) => !localIds.has(s.id));
      const results = await Promise.all([
        ...rows.map((r) => {
          const payload = {
            name: r.name.trim() || "Socio",
            role: r.role,
            pct: r.pct,
          };
          return r.id
            ? updateProfitShareAction(r.id, payload)
            : createProfitShareAction(payload);
        }),
        ...removed.map((s) => deleteProfitShareAction(s.id)),
      ]);
      // Las actions devuelven { ok:false } al rechazar (no lanzan): hay que
      // chequearlas, si no la UI muestra "guardado" aunque el server lo bloquee.
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        toast(
          failed.error.message || "No tenés permiso para esta acción.",
          "danger",
        );
        return;
      }
      toast("Reparto guardado", "success");
    } catch {
      toast("No se pudo guardar el reparto", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-card section-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="section-title">Reparto de la ganancia pura</div>
          <div className="text-faint mt-0.5 text-[12.5px]">
            Solo se divide la ganancia (no la amortización). Definí el % de cada
            uno.
          </div>
        </div>
        <span
          className={`badge ${balanced ? "badge-success" : "badge-warning"}`}
        >
          Suma {Math.round(total)}%
        </span>
      </div>

      <div className="gn-bar" style={{ margin: "14px 0 18px" }}>
        {rows.map((r, i) => (
          <span
            key={r.key}
            style={{
              width: `${Number(r.pct) || 0}%`,
              background: GN_COLORS[i % GN_COLORS.length],
            }}
            title={`${r.name} · ${r.pct}%`}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="gn-row">
            <span
              className="gn-dot"
              style={{ background: GN_COLORS[i % GN_COLORS.length] }}
            />
            <div className="gn-who">
              <input
                className="input gn-name"
                value={r.name}
                placeholder="Nombre"
                readOnly={!canEdit}
                onChange={(e) => set(r.key, "name", e.target.value)}
              />
              <input
                className="input gn-role"
                value={r.role}
                placeholder="Rol"
                readOnly={!canEdit}
                onChange={(e) => set(r.key, "role", e.target.value)}
              />
            </div>
            <div className="gn-pct">
              <input
                type="number"
                className="input"
                min={0}
                max={100}
                value={r.pct}
                disabled={!canEdit}
                onChange={(e) => set(r.key, "pct", e.target.value)}
              />
              <span className="text-faint">%</span>
            </div>
            <div className="gn-amount">
              {formatPrice((profit * (Number(r.pct) || 0)) / 100)}
            </div>
            <button
              type="button"
              className="btn-icon btn-ghost"
              onClick={() => removeRow(r.key)}
              style={
                rows.length <= 1 || !canEdit
                  ? { visibility: "hidden" }
                  : undefined
              }
              aria-label="Quitar socio"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {canEdit ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addRow}
          >
            + Agregar socio
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={balance}
          >
            Igualar al 100%
          </button>
          <Button type="button" size="sm" onClick={save} loading={busy}>
            {busy ? "Guardando…" : "Guardar reparto"}
          </Button>
        </div>
      ) : (
        <div className="text-faint mt-3.5 text-[12px]">
          Solo lectura: tu rol no tiene permiso para editar Ganancias.
        </div>
      )}
    </div>
  );
}
