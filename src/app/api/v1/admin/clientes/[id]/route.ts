import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import { customerDetailToJson } from "@/features/customers/admin-api";
import { manualCustomerSchema } from "@/features/customers/schemas";
import {
  getAdminCustomer,
  updateManualCustomer,
} from "@/features/customers/service";
import { isUuid } from "@/lib/ids";
import { loadOrThrow } from "@/lib/safe-load";

/**
 * /api/v1/admin/clientes/:id — ficha de un cliente (2026-10-31).
 *
 * GET   (clientes/ver): datos, métricas, historial de pedidos y puntos
 *       (`getAdminCustomer`, la misma fuente que /admin/clientes/[id]).
 * PATCH (clientes/editar): edita un cliente MANUAL. Los registrados no se
 *       editan (su perfil es del cliente); solo admiten la nota interna
 *       (ver ./nota). Igual que `updateManualCustomerAction`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(
  "admin/clientes/detalle",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "clientes", "ver");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    // Un id que no es UUID es un 404 directo (sin query que reviente en Postgres).
    if (!isUuid(id)) return apiError("not_found", "No encontramos el cliente.");

    const data = await loadOrThrow(
      "api:clientes/detalle",
      getAdminCustomer(id),
    );
    if (!data) return apiError("not_found", "No encontramos el cliente.");
    return apiOk(customerDetailToJson(data));
  },
);

export const PATCH = withApi(
  "admin/clientes/editar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "clientes", "editar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", "No encontramos el cliente.");

    const parsed = manualCustomerSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidBody(parsed.error);

    try {
      await updateManualCustomer(id, parsed.data);
      revalidatePath("/admin/clientes");
      revalidatePath(`/admin/clientes/${id}`);
      return apiOk({ ok: true });
    } catch (error) {
      // "No encontramos el cliente." si el id es de un registrado o no existe.
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);
