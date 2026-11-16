// Crea (o actualiza) la cuenta que usan los revisores de App Store y Google
// Play para entrar al panel desde la app (pedido de Ale, 2026-11-16).
// Rol "Revisor de tiendas": solo "ver" en todos los módulos, nunca crear,
// editar ni eliminar. La contraseña se genera al azar y se guarda en el
// archivo que se pasa como argumento (fuera del repo).
// Uso: pnpm tsx scripts/crear-revisor-tiendas.mts <archivo-salida>
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { PERM_MODULE_KEYS } from "../src/core/auth/perm-defs";

config({ path: ".env.local" });
const out = process.argv[2];
if (!out) throw new Error("Falta el archivo de salida");

const EMAIL = "revision.tiendas@hefesto3d.com.ar";
const ROLE = "Revisor de tiendas";
const password = `Hf3d-${randomBytes(9).toString("base64url")}`;
const perms = Object.fromEntries(PERM_MODULE_KEYS.map((k) => [k, ["ver"]]));

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: "require" });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const [role] = await sql`
  insert into roles (name, permissions, is_system, is_admin)
  values (${ROLE}, ${sql.json(perms)}, false, false)
  on conflict (name) do update set permissions = excluded.permissions, is_admin = false
  returning id`;

const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email?.toLowerCase() === EMAIL);
if (user) {
  const { error } = await sb.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) throw error;
} else {
  const { data, error } = await sb.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Revisión tiendas" },
  });
  if (error) throw error;
  user = data.user;
}

await sql`
  insert into profiles (id, full_name, role, role_id, must_change_password)
  values (${user.id}, 'Revisión tiendas', 'operator', ${role.id}, false)
  on conflict (id) do update set role = 'operator', role_id = ${role.id},
    must_change_password = false, full_name = 'Revisión tiendas'`;

writeFileSync(out, `email=${EMAIL}\npassword=${password}\n`);
console.log("listo: usuario", user.id, "rol", role.id);
await sql.end();
