import { NextResponse } from "next/server";
import { getStaffUser } from "@/core/auth/session";
import { rateLimit } from "@/core/security/rate-limit";
import { listProductsAdmin } from "@/features/products/services/catalogService";
import { listAdminCustomers } from "@/features/customers/service";
import { safeLoad } from "@/lib/safe-load";

/**
 * Búsqueda global del panel (Ctrl+K, 2026-10-21): productos y clientes por
 * nombre. Las páginas y acciones las resuelve el cliente sin pegarle a la
 * base. Respuesta chica y acotada (6 y 5 resultados) para que el buscador
 * responda al tipear.
 */
export const dynamic = "force-dynamic";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function GET(req: Request) {
  let staff;
  try {
    staff = await getStaffUser();
  } catch {
    return NextResponse.json({ error: "auth" }, { status: 503 });
  }
  if (!staff) return NextResponse.json({ error: "auth" }, { status: 401 });
  const rl = await rateLimit(`admin-search:${staff.id}`, {
    limit: 40,
    windowMs: 60_000,
  });
  if (!rl.ok) return NextResponse.json({ error: "rate" }, { status: 429 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ products: [], customers: [] });

  const [productsR, customersR] = await Promise.all([
    safeLoad(
      "search:products",
      listProductsAdmin({ search: q, page: 1, pageSize: 6 }).then(
        (r) => r.items,
      ),
      [],
    ),
    safeLoad("search:customers", listAdminCustomers(), []),
  ]);
  const nq = norm(q);
  const customers = customersR.value
    .filter((c) => norm(`${c.name} ${c.email ?? ""}`).includes(nq))
    .slice(0, 5);

  return NextResponse.json({
    products: productsR.value.map((p) => ({
      id: p.id,
      name: p.name,
      hint: [
        p.categoryName,
        p.status === "published" ? "Publicado" : "Borrador",
      ]
        .filter(Boolean)
        .join(" · "),
      image: p.primaryImage,
      href: `/admin/productos/${p.id}/editar`,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name || c.email || "Cliente",
      hint: c.email ?? "",
      href: `/admin/clientes/${c.id}`,
    })),
  });
}
