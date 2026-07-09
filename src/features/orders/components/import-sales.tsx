"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { importManualSalesAction } from "../actions";
import {
  buildTemplateRows,
  guessMapping,
  parseImportRow,
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  type ImportFieldKey,
} from "../import-sales";

const ACCEPTED = [".xlsx", ".xls", ".csv"];
const MAX_FILE_MB = 8;

type LoadedSheet = {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: unknown[][];
};

type ImportOutcome = {
  imported: number;
  failed: Array<{ row: number; message: string }>;
};

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Importador de ventas desde Excel/CSV (Fase: /admin/pedidos/importar).
 * Flujo: archivo → mapeo de columnas (adivinado por encabezado, corregible) →
 * preview + validación fila por fila → importar SOLO las válidas → resumen.
 * El parseo del archivo es 100% en el navegador (SheetJS, import dinámico);
 * al server viajan las filas crudas + el mapeo, y allá se re-valida todo.
 */
export function ImportSales() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<LoadedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, number> | null>(
    null,
  );
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  // Validación en vivo: se rehace si cambia el archivo o el mapeo.
  const validation = useMemo(() => {
    if (!sheet || !mapping) return null;
    const okRows: number[] = [];
    const errors: Array<{ row: number; messages: string[] }> = [];
    sheet.rows.forEach((cells, i) => {
      const r = parseImportRow(cells, mapping);
      if (r.ok) okRows.push(i);
      else errors.push({ row: i + 2, messages: r.errors }); // +2: 1-based + encabezado
    });
    return { okRows, errors };
  }, [sheet, mapping]);

  const requiredMissing = useMemo(() => {
    if (!mapping) return [];
    return IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === -1);
  }, [mapping]);

  async function handleFile(file: File) {
    setFileError(null);
    setOutcome(null);
    setSheet(null);
    setMapping(null);
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ACCEPTED.includes(ext)) {
      setFileError(
        `Formato no soportado (${ext}). Aceptamos ${ACCEPTED.join(", ")}.`,
      );
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`El archivo supera los ${MAX_FILE_MB} MB.`);
      return;
    }
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { cellDates: true });
      const wsName = wb.SheetNames[0];
      const ws = wsName ? wb.Sheets[wsName] : undefined;
      if (!ws) throw new Error("El archivo no tiene hojas.");
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: "",
      });
      const nonEmpty = aoa.filter((row) =>
        row.some((c) => String(c ?? "").trim() !== ""),
      );
      if (nonEmpty.length < 2) {
        setFileError(
          "La planilla está vacía (necesita encabezados + al menos una fila).",
        );
        return;
      }
      const headers = (nonEmpty[0] ?? []).map((h) => String(h ?? ""));
      const rows = nonEmpty.slice(1);
      if (rows.length > IMPORT_MAX_ROWS) {
        setFileError(
          `La planilla tiene ${rows.length} filas; el máximo es ${IMPORT_MAX_ROWS} por importación.`,
        );
        return;
      }
      setSheet({ fileName: file.name, fileSize: file.size, headers, rows });
      setMapping(guessMapping(headers));
    } catch (e) {
      console.error("[importar] no se pudo leer el archivo:", e);
      setFileError(
        "No se pudo leer el archivo. ¿Está dañado o protegido con contraseña?",
      );
    } finally {
      setLoading(false);
    }
  }

  async function importar() {
    if (!sheet || !mapping || !validation) return;
    const validRows = validation.okRows.map((i) => sheet.rows[i]!);
    const res = await runAction(
      () =>
        importManualSalesAction({
          rows: validRows,
          mapping,
          firstRowNumber: 2,
        }),
      { label: `Importando ${validRows.length} ventas…`, silent: true },
    );
    if (!res.ok) {
      toast(res.error.message, "danger");
      return;
    }
    setOutcome(res.data);
    if (res.data.imported > 0) {
      toast(`${res.data.imported} ventas importadas`, "success");
      router.refresh();
    }
  }

  async function downloadTemplateXlsx() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(buildTemplateRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "plantilla-ventas-hefesto.xlsx");
  }

  function downloadTemplateCsv() {
    const csv = buildTemplateRows()
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-ventas-hefesto.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const validCount = validation?.okRows.length ?? 0;
  const canImport =
    !!sheet && !!mapping && requiredMissing.length === 0 && validCount > 0;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {/* Plantillas */}
      <div className="ui-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-[14px] font-semibold">
            ¿Primera vez? Bajate la plantilla
          </div>
          <div className="text-faint text-[12px]">
            Columnas esperadas: fecha, cliente, total (obligatorias) + detalle,
            cantidad, pago, estado, material, gramos, minutos o costo unitario.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={downloadTemplateXlsx}>
            Plantilla .xlsx
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadTemplateCsv}>
            Plantilla .csv
          </Button>
        </div>
      </div>

      {/* Dropzone */}
      <div
        className="ui-card flex flex-col items-center gap-3 p-8 text-center"
        style={{
          border: `2px dashed ${dragOver ? "var(--gold)" : "var(--border)"}`,
          background: dragOver ? "rgba(var(--gold-rgb), .06)" : undefined,
          transition: "border-color .15s ease, background .15s ease",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <div className="text-[14.5px] font-semibold">
          Arrastrá tu planilla acá
        </div>
        <div className="text-faint text-[12.5px]">
          Excel (.xlsx, .xls) o CSV · hasta {MAX_FILE_MB} MB · {IMPORT_MAX_ROWS}{" "}
          filas máx.
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {sheet ? (
          <div className="text-dim text-[12.5px]">
            <b className="text-fg">{sheet.fileName}</b> ·{" "}
            {fmtSize(sheet.fileSize)} · {sheet.rows.length} filas
          </div>
        ) : null}
        {fileError ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-[12.5px]">
            {fileError}
          </p>
        ) : null}
      </div>

      {/* Mapeo + preview */}
      {sheet && mapping ? (
        <div className="ui-card p-5">
          <div className="section-title mb-1 text-[15px]">
            Mapeo de columnas
          </div>
          <div className="text-faint mb-4 text-[12px]">
            Adiviné las columnas por el encabezado; corregí lo que haga falta.
            Los campos con * son obligatorios.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="field">
                <label htmlFor={`map-${f.key}`}>
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
                <select
                  id={`map-${f.key}`}
                  className="input"
                  value={mapping[f.key]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>— No está en la planilla —</option>
                  {sheet.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {requiredMissing.length > 0 ? (
            <p className="bg-danger/10 text-danger mt-3 rounded-md px-3 py-2 text-[12.5px]">
              Falta mapear: {requiredMissing.map((f) => f.label).join(", ")}.
            </p>
          ) : null}

          {/* Preview de las primeras filas */}
          <div className="section-title mt-5 mb-2 text-[13px]">
            Vista previa (primeras {Math.min(5, sheet.rows.length)} filas)
          </div>
          <div className="table-wrap">
            <table className="admin-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  {sheet.headers.map((h, i) => (
                    <th key={`${h}-${i}`}>{h || `Col ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 5).map((row, ri) => (
                  <tr key={ri}>
                    {sheet.headers.map((_h, ci) => (
                      <td key={ci}>
                        {row[ci] instanceof Date
                          ? (row[ci] as Date).toLocaleDateString("es-AR")
                          : String(row[ci] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validación */}
          {validation ? (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-success">
                  {validCount} filas válidas
                </span>
                {validation.errors.length > 0 ? (
                  <span className="badge badge-danger">
                    {validation.errors.length} con errores (no se importan)
                  </span>
                ) : null}
              </div>
              {validation.errors.length > 0 ? (
                <ul
                  className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg p-3 text-[12px]"
                  style={{ background: "var(--surface-2)" }}
                >
                  {validation.errors.slice(0, 50).map((e) => (
                    <li key={e.row} className="text-dim">
                      <b className="text-danger">Fila {e.row}:</b>{" "}
                      {e.messages.join(" ")}
                    </li>
                  ))}
                  {validation.errors.length > 50 ? (
                    <li className="text-faint">
                      …y {validation.errors.length - 50} más.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button disabled={!canImport} onClick={() => void importar()}>
              Importar {validCount > 0 ? `${validCount} ` : ""}ventas
            </Button>
          </div>
        </div>
      ) : null}

      {/* Resumen final */}
      {outcome ? (
        <div className="ui-card p-5">
          <div className="section-title mb-2 text-[15px]">
            Resultado de la importación
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-success">
              {outcome.imported} importadas
            </span>
            {outcome.failed.length > 0 ? (
              <span className="badge badge-danger">
                {outcome.failed.length} fallidas
              </span>
            ) : null}
          </div>
          {outcome.failed.length > 0 ? (
            <ul
              className="mt-3 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg p-3 text-[12px]"
              style={{ background: "var(--surface-2)" }}
            >
              {outcome.failed.map((f) => (
                <li key={f.row} className="text-dim">
                  <b className="text-danger">Fila {f.row}:</b> {f.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dim mt-2 text-[12.5px]">
              Todo importado. Las ventas ya aparecen en Pedidos, Ganancias y
              Reportes.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
