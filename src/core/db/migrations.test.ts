import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia del sistema de migraciones.
 *
 * Drizzle NO ejecuta los archivos que encuentra en la carpeta: ejecuta los que
 * están listados en `meta/_journal.json`. Un `.sql` sin su entrada en el
 * journal se ignora **en silencio** — `pnpm db:migrate` dice "Migraciones
 * aplicadas OK" y la columna nunca se crea.
 *
 * Eso pasó de verdad el 2026-08-03 con `0069_order_shipping_cost`: producción
 * quedó con el código nuevo pidiendo una columna inexistente, el checkout
 * devolvía "Ocurrió un error" y el panel no podía listar los pedidos online.
 * Se perdió un buen rato buscando el bug en el checkout, que estaba perfecto.
 *
 * Este test cuesta milisegundos y hace imposible repetirlo.
 */

const DIR = path.join(process.cwd(), "src/core/db/migrations");

type Journal = {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

function leerJournal(): Journal {
  return JSON.parse(
    fs.readFileSync(path.join(DIR, "meta/_journal.json"), "utf8"),
  ) as Journal;
}

function archivosSql(): string[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

describe("migraciones · journal", () => {
  it("cada archivo .sql está registrado en el journal", () => {
    const enJournal = new Set(leerJournal().entries.map((e) => e.tag));
    const faltantes = archivosSql().filter((tag) => !enJournal.has(tag));
    expect(
      faltantes,
      `Estas migraciones NO están en meta/_journal.json y NUNCA se van a ejecutar: ${faltantes.join(", ")}`,
    ).toEqual([]);
  });

  it("cada entrada del journal tiene su archivo .sql", () => {
    const archivos = new Set(archivosSql());
    const huerfanas = leerJournal()
      .entries.map((e) => e.tag)
      .filter((tag) => !archivos.has(tag));
    expect(
      huerfanas,
      `El journal nombra migraciones que no existen: ${huerfanas.join(", ")}`,
    ).toEqual([]);
  });

  it("los índices del journal son consecutivos y sin repetidos", () => {
    const idx = leerJournal().entries.map((e) => e.idx);
    expect(idx).toEqual(idx.map((_, i) => i));
  });

  it("el orden del journal respeta la numeración de los archivos", () => {
    // Si una migración vieja se cuela después de una nueva, se aplica fuera de
    // orden y puede fallar (ej. agregar un índice a una columna que aún no
    // existe).
    const tags = leerJournal().entries.map((e) => e.tag);
    const numeros = tags.map((t) => Number(t.slice(0, 4)));
    const ordenados = [...numeros].sort((a, b) => a - b);
    expect(numeros).toEqual(ordenados);
  });
});
