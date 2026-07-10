"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { toast } from "@/stores/toastStore";
import {
  addJobAction,
  addPrinterAction,
  setJobStatusAction,
  setPrinterStatusAction,
} from "../actions";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_VARIANT,
  PRINTER_STATUS_LABEL,
  PRINTER_STATUS_VARIANT,
} from "../constants";
import type { JobRow, JobStatus, Printer, PrinterStatus } from "../repository";
import { runAction } from "@/lib/run-action";

const PRINTER_STATES: PrinterStatus[] = [
  "idle",
  "printing",
  "maintenance",
  "offline",
];
const JOB_STATES: JobStatus[] = ["queued", "printing", "done", "failed"];

const ic = (path: string, size?: number) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const PRINTER_PATH =
  '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>';

export function ProductionBoard({
  printers,
  jobs,
}: {
  printers: Printer[];
  jobs: JobRow[];
}) {
  const [printerOpen, setPrinterOpen] = useState(false);
  const [jobOpen, setJobOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pModel, setPModel] = useState("");
  const [jTitle, setJTitle] = useState("");
  const [jPrinter, setJPrinter] = useState("");
  const [busy, setBusy] = useState(false);

  const printing = printers.filter((p) => p.status === "printing").length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const maint = printers.filter(
    (p) => p.status === "maintenance" || p.status === "offline",
  ).length;
  const done = jobs.filter((j) => j.status === "done").length;

  async function addPrinter() {
    setBusy(true);
    const res = await runAction(() => addPrinterAction(pName, pModel), {
      silent: true,
    });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Impresora conectada", "success");
    setPName("");
    setPModel("");
    setPrinterOpen(false);
  }

  async function addJob() {
    setBusy(true);
    const res = await runAction(() => addJobAction(jTitle, jPrinter), {
      silent: true,
    });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Trabajo encolado", "success");
    setJTitle("");
    setJPrinter("");
    setJobOpen(false);
  }

  async function changePrinter(id: string, status: PrinterStatus) {
    const res = await runAction(() => setPrinterStatusAction(id, status), {
      silent: true,
    });
    if (!res.ok) toast(res.error.message, "danger");
  }

  async function changeJob(id: string, status: JobStatus) {
    const res = await runAction(() => setJobStatusAction(id, status), {
      silent: true,
    });
    if (!res.ok) toast(res.error.message, "danger");
  }

  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Producción</div>
          <h1 className="page-title">Cola de impresión</h1>
          <div className="page-sub">
            {printing} de {printers.length} impresoras imprimiendo · cola del
            taller
          </div>
        </div>
        <Button type="button" onClick={() => setPrinterOpen(true)}>
          + Conectar impresora
        </Button>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(PRINTER_PATH)}
          label="Impresoras imprimiendo"
          value={`${printing}/${printers.length}`}
          tint="#5A9CD9"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
          )}
          label="Trabajos en cola"
          value={String(queued)}
          tint="#C9A84C"
        />
        <KpiCard
          icon={ic(
            '<path d="M14.7 6.3a4 4 0 0 0-5.66 5.66l1.06 1.06"/><path d="M3 21l6-6"/>',
          )}
          label="En mantenimiento"
          value={String(maint)}
          up={false}
          tint="#D9A441"
        />
        <KpiCard
          icon={ic('<path d="M20 6 9 17l-5-5"/>')}
          label="Trabajos terminados"
          value={String(done)}
          tint="#4CB782"
        />
      </div>

      <div className="dash-grid">
        {/* GRANJA */}
        <div className="grid gap-3">
          <div className="section-title">Granja de impresoras</div>
          {printers.length === 0 ? (
            <div className="ui-card section-card text-dim p-8 text-center text-sm">
              No hay impresoras. Conectá la primera.
            </div>
          ) : (
            <div className="grid-2">
              {printers.map((p) => (
                <div key={p.id} className="ui-card" style={{ padding: 16 }}>
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="kpi-ic"
                        style={{ width: 40, height: 40 }}
                      >
                        {ic(PRINTER_PATH, 19)}
                      </span>
                      <div>
                        <div className="text-[14px] font-semibold">
                          {p.name}
                        </div>
                        <div className="text-faint text-[11.5px]">
                          {p.model ?? "—"}
                        </div>
                      </div>
                    </div>
                    <Badge variant={PRINTER_STATUS_VARIANT[p.status]}>
                      {PRINTER_STATUS_LABEL[p.status]}
                    </Badge>
                  </div>
                  <div className="field">
                    <label className="text-faint mb-1 block text-[11px]">
                      Cambiar estado
                    </label>
                    <select
                      className="select"
                      value={p.status}
                      onChange={(e) =>
                        changePrinter(p.id, e.target.value as PrinterStatus)
                      }
                    >
                      {PRINTER_STATES.map((s) => (
                        <option key={s} value={s}>
                          {PRINTER_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLA */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="section-title">Cola de trabajos</div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setJobOpen(true)}
            >
              + Encolar
            </Button>
          </div>
          <div className="ui-card section-card" style={{ padding: 16 }}>
            {jobs.length === 0 ? (
              <div className="text-dim py-8 text-center text-sm">
                Cola vacía · todo asignado.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="ui-card flex items-center justify-between"
                    style={{ padding: "11px 13px" }}
                  >
                    <div className="min-w-0">
                      <b className="block truncate text-[13px]">{j.title}</b>
                      <div className="text-faint text-[11.5px]">
                        {j.printerName ?? "Sin asignar"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={JOB_STATUS_VARIANT[j.status]}>
                        {JOB_STATUS_LABEL[j.status]}
                      </Badge>
                      <select
                        className="select"
                        style={{
                          width: "auto",
                          padding: "6px 26px 6px 9px",
                          fontSize: "12px",
                        }}
                        value={j.status}
                        onChange={(e) =>
                          changeJob(j.id, e.target.value as JobStatus)
                        }
                      >
                        {JOB_STATES.map((s) => (
                          <option key={s} value={s}>
                            {JOB_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ui-card text-faint flex items-start gap-2 p-4 text-[12px] leading-relaxed">
            <span className="text-[var(--gold-bright)]">
              {ic(
                '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
                16,
              )}
            </span>
            <p>
              El monitoreo en vivo (progreso, temperaturas, conexión Bambu Lab)
              requiere integración con las impresoras y aún no está disponible.
            </p>
          </div>
        </div>
      </div>

      <Modal
        open={printerOpen}
        onClose={() => setPrinterOpen(false)}
        title="Conectar impresora"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="field">
            <label htmlFor="pp-name">Nombre</label>
            <input
              id="pp-name"
              className="input"
              placeholder="Ej: Bambu Lab P1S"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pp-model">Modelo</label>
            <input
              id="pp-model"
              className="input"
              placeholder="Ej: P1S / A1 / X1C"
              value={pModel}
              onChange={(e) => setPModel(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPrinterOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={addPrinter} loading={busy}>
              {busy ? "Conectando…" : "Conectar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={jobOpen}
        onClose={() => setJobOpen(false)}
        title="Encolar trabajo"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="field">
            <label htmlFor="jj-title">Título / pieza</label>
            <input
              id="jj-title"
              className="input"
              placeholder="Ej: Lote de 10 llaveros"
              value={jTitle}
              onChange={(e) => setJTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="jj-printer">Impresora (opcional)</label>
            <select
              id="jj-printer"
              className="select"
              value={jPrinter}
              onChange={(e) => setJPrinter(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setJobOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={addJob} loading={busy}>
              {busy ? "Encolando…" : "Encolar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
