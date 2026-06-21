"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportSalesCsvAction } from "../actions";

export function ExportCsvButton({ days }: { days: number }) {
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const res = await exportSalesCsvAction(
      from.toISOString(),
      to.toISOString(),
    );
    setBusy(false);
    if (!res.ok) return;
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={exportCsv}>
      {busy ? "Generando…" : "Exportar CSV"}
    </Button>
  );
}
