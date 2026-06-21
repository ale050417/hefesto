"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const PRINTER_STATES: PrinterStatus[] = [
  "idle",
  "printing",
  "maintenance",
  "offline",
];
const JOB_STATES: JobStatus[] = ["queued", "printing", "done", "failed"];

export function ProductionBoard({
  printers,
  jobs,
}: {
  printers: Printer[];
  jobs: JobRow[];
}) {
  const router = useRouter();
  const [pName, setPName] = useState("");
  const [pModel, setPModel] = useState("");
  const [jTitle, setJTitle] = useState("");
  const [jPrinter, setJPrinter] = useState("");

  async function run(p: Promise<{ ok: boolean; error?: { message: string } }>) {
    const res = await p;
    if (res.ok) router.refresh();
    else toast(res.error?.message ?? "Error", "danger");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="grid gap-3">
        <h2 className="text-fg font-display text-lg">Impresoras</h2>
        <form
          className="ui-card flex flex-wrap items-end gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(addPrinterAction(pName, pModel)).then(() => {
              setPName("");
              setPModel("");
            });
          }}
        >
          <input
            className="input flex-1"
            placeholder="Nombre (Ender 3)"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            required
          />
          <input
            className="input flex-1"
            placeholder="Modelo (opcional)"
            value={pModel}
            onChange={(e) => setPModel(e.target.value)}
          />
          <Button type="submit" variant="primary">
            Agregar
          </Button>
        </form>
        {printers.length === 0 ? (
          <p className="text-dim text-sm">No hay impresoras cargadas.</p>
        ) : (
          printers.map((pr) => (
            <div
              key={pr.id}
              className="ui-card flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="text-fg font-medium">{pr.name}</p>
                {pr.model ? (
                  <p className="text-dim text-xs">{pr.model}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={PRINTER_STATUS_VARIANT[pr.status]}>
                  {PRINTER_STATUS_LABEL[pr.status]}
                </Badge>
                <select
                  className="select"
                  value={pr.status}
                  onChange={(e) =>
                    run(
                      setPrinterStatusAction(
                        pr.id,
                        e.target.value as PrinterStatus,
                      ),
                    )
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
          ))
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-fg font-display text-lg">Cola de impresión</h2>
        <form
          className="ui-card flex flex-wrap items-end gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(addJobAction(jTitle, jPrinter)).then(() => setJTitle(""));
          }}
        >
          <input
            className="input flex-1"
            placeholder="Trabajo (Llavero x10)"
            value={jTitle}
            onChange={(e) => setJTitle(e.target.value)}
            required
          />
          <select
            className="select"
            value={jPrinter}
            onChange={(e) => setJPrinter(e.target.value)}
          >
            <option value="">Sin asignar</option>
            {printers.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="primary">
            Agregar
          </Button>
        </form>
        {jobs.length === 0 ? (
          <p className="text-dim text-sm">No hay trabajos en la cola.</p>
        ) : (
          jobs.map((j) => (
            <div
              key={j.id}
              className="ui-card flex items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="text-fg font-medium">{j.title}</p>
                <p className="text-dim text-xs">
                  {j.printerName ?? "Sin asignar"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={JOB_STATUS_VARIANT[j.status]}>
                  {JOB_STATUS_LABEL[j.status]}
                </Badge>
                <select
                  className="select"
                  value={j.status}
                  onChange={(e) =>
                    run(setJobStatusAction(j.id, e.target.value as JobStatus))
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
          ))
        )}
      </section>
    </div>
  );
}
