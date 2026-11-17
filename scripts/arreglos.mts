// Arreglos que cargó el equipo en el panel, para leerlos desde la terminal
// (pedido de Ale, 2026-11-17: "que quede todo documentado así cuando te pido
// que leas todo y arregles, yo arreglo").
//
//   pnpm arreglos                 → los que faltan resolver (Markdown)
//   pnpm arreglos --todos         → también los resueltos
//   pnpm arreglos --json          → lo mismo en JSON
//   pnpm arreglos --fotos <dir>   → además baja las fotos a esa carpeta
//   pnpm arreglos --en-curso <id> ["nota"]   → lo marca en curso
//   pnpm arreglos --resuelto <id> ["nota"]   → lo marca resuelto, con la nota
//                                              que ve quien lo cargó
//
// Lee la misma base que el panel (DATABASE_URL de .env.local).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { default: postgres } = await import("postgres");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL en .env.local");
const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueOf = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Resuelto",
};

type Row = {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  status: string;
  images: string[];
  owner_note: string | null;
  created_by_name: string | null;
  created_at: Date;
};

try {
  const setTo = flag("--resuelto")
    ? "done"
    : flag("--en-curso")
      ? "in_progress"
      : null;
  if (setTo) {
    const id = valueOf(setTo === "done" ? "--resuelto" : "--en-curso");
    if (!id) throw new Error("Falta el id del arreglo.");
    const idx = args.indexOf(id);
    const note =
      args[idx + 1] && !args[idx + 1]!.startsWith("--") ? args[idx + 1]! : null;
    const rows = await sql<Row[]>`
      update fix_requests
      set status = ${setTo},
          owner_note = coalesce(${note}, owner_note),
          resolved_at = ${setTo === "done" ? sql`now()` : null},
          updated_at = now()
      where id::text like ${id + "%"}
      returning id, title, status`;
    if (rows.length !== 1) {
      throw new Error(
        rows.length === 0
          ? `No hay ningún arreglo con id ${id}.`
          : `El id ${id} coincide con ${rows.length} arreglos: usá más caracteres.`,
      );
    }
    // Que quien lo cargó se entere (campanita del panel).
    await sql`
      insert into notifications (audience, title, body, link)
      values ('admin', ${"Arreglo " + LABEL[setTo]!.toLowerCase()},
              ${note ? `${rows[0]!.title} — ${note}` : rows[0]!.title},
              '/admin/arreglos')`;
    console.log(`${LABEL[setTo]}: ${rows[0]!.title}`);
  } else {
    const rows = await sql<Row[]>`
      select id, title, description, urgent, status, images, owner_note,
             created_by_name, created_at
      from fix_requests
      ${flag("--todos") ? sql`` : sql`where status <> 'done'`}
      order by urgent desc, created_at asc`;

    const dir = valueOf("--fotos");
    const local = new Map<string, string>();
    if (dir) {
      mkdirSync(dir, { recursive: true });
      for (const r of rows) {
        for (const [i, imageUrl] of r.images.entries()) {
          const res = await fetch(imageUrl);
          if (!res.ok) continue;
          const file = path.join(dir, `${r.id.slice(0, 8)}-${i + 1}.webp`);
          writeFileSync(file, Buffer.from(await res.arrayBuffer()));
          local.set(imageUrl, path.resolve(file));
        }
      }
    }

    if (flag("--json")) {
      console.log(
        JSON.stringify(
          rows.map((r) => ({
            ...r,
            files: r.images.map((u) => local.get(u) ?? null),
          })),
          null,
          2,
        ),
      );
    } else if (rows.length === 0) {
      console.log("No hay arreglos pendientes.");
    } else {
      console.log(`# Arreglos (${rows.length})\n`);
      for (const r of rows) {
        const when = r.created_at.toISOString().slice(0, 10);
        console.log(
          `## ${r.urgent ? "[URGENTE] " : ""}${r.title}\n` +
            `- id: ${r.id.slice(0, 8)} · ${LABEL[r.status] ?? r.status} · ` +
            `${r.created_by_name ?? "equipo"} · ${when}\n\n${r.description}\n`,
        );
        if (r.owner_note) console.log(`Respuesta: ${r.owner_note}\n`);
        for (const u of r.images) {
          console.log(`- foto: ${local.get(u) ?? u}`);
        }
        console.log("");
      }
    }
  }
} finally {
  await sql.end();
}
