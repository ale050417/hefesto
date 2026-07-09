"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import { deleteFailureAction } from "../actions";
import { filColor } from "../constants";
import { FailureForm } from "./failure-form";
import { runAction } from "@/lib/run-action";

export type FailureRow = {
  id: string;
  createdAt: string;
  pieceName: string;
  material: string;
  color: string;
  gramsLost: number;
  reason: string;
  notes: string | null;
  cost: number;
};

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

export function FailuresTable({
  failures,
  materials,
}: {
  failures: FailureRow[];
  materials: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FailureRow | null>(null);
  const [confirming, setConfirming] = useState<FailureRow | null>(null);

  async function confirmRemove(f: FailureRow) {
    const res = await runAction(() => deleteFailureAction(f.id), {
      silent: true,
    });
    if (!res.ok) throw new Error(res.error.message);
    toast("Falla eliminada · gramos devueltos al stock", "success");
    router.refresh();
  }

  return (
    <>
      <div className="ui-card">
        <div className="table-wrap" style={{ border: "none" }}>
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pieza</th>
                <th>Material</th>
                <th>Color</th>
                <th>Gramos</th>
                <th>Costo</th>
                <th>Causa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id}>
                  <td className="muted whitespace-nowrap" data-label="Fecha">
                    {f.createdAt}
                  </td>
                  <td data-label="Pieza">
                    <b>{f.pieceName || "—"}</b>
                    {f.notes ? (
                      <div className="text-faint text-[11px]">{f.notes}</div>
                    ) : null}
                  </td>
                  <td className="muted" data-label="Material">
                    {f.material ?? "—"}
                  </td>
                  <td data-label="Color">
                    <span className="flex items-center gap-2 text-[12.5px]">
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: "50%",
                          background: filColor(f.color ?? ""),
                          border: "1px solid rgba(255,255,255,.25)",
                        }}
                      />
                      {f.color ?? "—"}
                    </span>
                  </td>
                  <td data-label="Gramos">
                    <b>{f.gramsLost} g</b>
                  </td>
                  <td
                    className="price"
                    style={{ color: "var(--danger)" }}
                    data-label="Costo"
                  >
                    {formatPrice(f.cost)}
                  </td>
                  <td data-label="Causa">
                    <span className="badge badge-danger">{f.reason}</span>
                  </td>
                  <td data-label="">
                    <div className="flex justify-end gap-1">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar falla"
        size="lg"
      >
        {editing ? (
          <FailureForm
            materials={materials}
            failure={{
              id: editing.id,
              pieceName: editing.pieceName,
              material: editing.material,
              color: editing.color,
              gramsLost: editing.gramsLost,
              reason: editing.reason,
              notes: editing.notes,
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
            ? `¿Eliminar la falla de ${confirming.pieceName || "—"}?`
            : "¿Eliminar falla?"
        }
        detail={
          confirming
            ? `Se devolverán ${confirming.gramsLost} g de ${confirming.material} ${confirming.color} al stock.`
            : undefined
        }
        onConfirm={() => {
          if (confirming) return confirmRemove(confirming);
        }}
      />
    </>
  );
}
