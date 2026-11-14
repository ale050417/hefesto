import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import {
  CUSTOMER_TIERS,
  customerCounts,
  customerToJson,
  filterAdminCustomers,
  tiersInfo,
} from "@/features/customers/admin-api";
import { manualCustomerSchema } from "@/features/customers/schemas";
import {
  createManualCustomer,
  listAdminCustomers,
} from "@/features/customers/service";
import { loadOrThrow } from "@/lib/safe-load";

/**
 * /api/v1/admin/clientes — módulo Clientes de la app (2026-10-31).
 *
 * GET  (clientes/ver): lista unificada (registrados con métricas + manuales),
 *      más nuevos primero. Query opcional: `q` (nombre, email, teléfono,
 *      ciudad) y `tier` (gold|silver|bronze). `counts` y `totalSpent` son de la
 *      lista COMPLETA (no del filtro), como el encabezado de /admin/clientes.
 * POST (clientes/crear): alta de cliente manual (sin cuenta). Mismo schema y
 *      mismos efectos que `createManualCustomerAction`.
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  tier: z.enum(CUSTOMER_TIERS).optional(),
});

export const GET = withApi("admin/clientes", async (request: Request) => {
  const auth = await requireApiPerm(request, "clientes", "ver");
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return apiError("invalid", "Filtros inválidos.");

  // Con deadline: si la base se traba, error claro en vez de colgarse.
  const all = await loadOrThrow("api:clientes", listAdminCustomers());
  const items = filterAdminCustomers(all, parsed.data);

  return apiOk({
    items: items.map(customerToJson),
    total: items.length,
    counts: customerCounts(all),
    totalSpent: all.reduce((sum, c) => sum + c.spent, 0),
    tiers: tiersInfo(),
  });
});

export const POST = withApi(
  "admin/clientes/crear",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "clientes", "crear");
    if ("response" in auth) return auth.response;

    const parsed = manualCustomerSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidBody(parsed.error);

    try {
      const created = await createManualCustomer(parsed.data, auth.user.id);
      revalidatePath("/admin/clientes");
      return apiOk({ id: created.id }, { status: 201 });
    } catch (error) {
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);
