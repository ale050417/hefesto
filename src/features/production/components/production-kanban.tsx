"use client";

import { useState } from "react";
import type { JobRow, JobStatus } from "../repository";

const COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: "queued", label: "En cola", color: "var(--warning)" },
  { status: "printing", label: "Imprimiendo", color: "var(--gold)" },
  { status: "done", label: "Terminado", color: "var(--success)" },
  { status: "failed", label: "Falló", color: "var(--danger)" },
];

function since(d: Date | string): { text: string; hours: number } {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return { text: "recién", hours: 0 };
  if (h < 24) return { text: `hace ${h} h`, hours: h };
  return { text: `hace ${Math.floor(h / 24)} d`, hours: h };
}

export function ProductionKanban({
  jobs,
  onMove,
}: {
  jobs: JobRow[];
  onMove: (id: string, status: JobStatus) => void;
}) {
  const [over, setOver] = useState<JobStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = jobs.filter((j) => j.status === col.status);
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
              if (id) onMove(id, col.status);
              setDragId(null);
            }}
            className="ui-card section-card flex-shrink-0"
            style={{
              width: 234,
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
              <b className="text-[13px]">{col.label}</b>
              <span className="text-faint ml-auto text-[12px]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2" style={{ minHeight: 44 }}>
              {items.map((j) => {
                const s = since(j.createdAt);
                const late =
                  (col.status === "queued" || col.status === "printing") &&
                  s.hours >= 24;
                return (
                  <div
                    key={j.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", j.id);
                      setDragId(j.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className="ui-card"
                    style={{
                      padding: "9px 11px",
                      cursor: "grab",
                      opacity: dragId === j.id ? 0.5 : 1,
                    }}
                  >
                    <b className="block truncate text-[13px]">{j.title}</b>
                    <div className="text-faint mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">
                        {j.printerName ?? "Sin asignar"}
                      </span>
                      <span
                        className="flex-shrink-0"
                        style={{ color: late ? "var(--danger)" : undefined }}
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
                  Soltá acá
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
