import { formatPrice } from "@/lib/format";
import type { FilamentView } from "./types";

/**
 * Informe de stock de filamentos para copiar o mandar por WhatsApp (pedido de
 * Ale, 2026-10-30). Puro: la fecha llega por parámetro, así se testea.
 *
 * Se arma sobre TODO el inventario, no sobre los filtros de la pantalla: es el
 * estado general del stock. Un stock negativo (se gastó más de lo cargado)
 * cuenta como 0.
 */

const STATUS_RANK: Record<FilamentView["status"], number> = {
  agotado: 0,
  bajo: 1,
  ok: 2,
};

const grams = (f: FilamentView) => Math.max(0, f.stockGrams);

function fmtGrams(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;
}

function byMaterialAndColor(a: FilamentView, b: FilamentView): number {
  return (
    a.material.localeCompare(b.material, "es") ||
    a.color.localeCompare(b.color, "es")
  );
}

export function buildFilamentReport(
  filaments: FilamentView[],
  now: Date,
): string {
  const lines = [
    "📦 INFORME DE FILAMENTOS — HEFESTO 3D",
    `Fecha: ${now.toLocaleDateString("es-AR")}`,
  ];
  if (filaments.length === 0) {
    return [...lines, "", "No hay filamentos cargados."].join("\n");
  }

  const totalG = filaments.reduce((acc, f) => acc + grams(f), 0);
  const valor = filaments.reduce(
    (acc, f) => acc + (grams(f) / 1000) * f.costPerKg,
    0,
  );
  const count = (s: FilamentView["status"]) =>
    filaments.filter((f) => f.status === s).length;

  lines.push(
    "",
    "RESUMEN",
    `• Total en stock: ${fmtGrams(totalG)}`,
    `• Valor estimado: ${formatPrice(valor)}`,
    `• Colores: ${filaments.length} (en stock ${count("ok")}, bajo ${count("bajo")}, agotado ${count("agotado")})`,
  );

  // Lo que hay que reponer: primero los agotados.
  const reponer = filaments
    .filter((f) => f.status !== "ok")
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        byMaterialAndColor(a, b),
    );
  lines.push("", "A REPONER");
  if (reponer.length === 0) lines.push("• Nada por ahora ✅");
  for (const f of reponer) {
    const estado =
      f.status === "agotado" ? "agotado" : `${fmtGrams(grams(f))} (stock bajo)`;
    lines.push(`• ${f.material} ${f.color} · ${f.brand}: ${estado}`);
  }

  // Detalle por material, con el stock de cada color.
  const sorted = [...filaments].sort(byMaterialAndColor);
  const materials = [...new Set(sorted.map((f) => f.material))];
  lines.push("", "POR MATERIAL");
  for (const m of materials) {
    const items = sorted.filter((f) => f.material === m);
    const g = items.reduce((acc, f) => acc + grams(f), 0);
    const colores = items.length === 1 ? "color" : "colores";
    lines.push("", `${m}: ${fmtGrams(g)} (${items.length} ${colores})`);
    for (const f of items) {
      lines.push(`• ${f.color} · ${f.brand}: ${fmtGrams(grams(f))}`);
    }
  }

  return lines.join("\n");
}
