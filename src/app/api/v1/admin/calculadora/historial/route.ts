import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { AppError } from "@/core/errors";
import { saveCalcFlow } from "@/features/calculator/flows";
import { calcSaveSchema } from "@/features/calculator/schemas";

/**
 * POST /api/v1/admin/calculadora/historial — guarda un cálculo en el historial
 * (2026-10-31). Permiso calculadora/crear, igual que `saveCalcAction`. El
 * servidor resuelve el costo/kg y el snapshot material/color desde el
 * FILAMENTO elegido y el margen desde el TIPO: la app nunca los manda.
 * Body: { name, customer?, filamentId, grams, hours, presetId, notes? }.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/calculadora/historial",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "calculadora", "crear");
    if ("response" in auth) return auth.response;

    const parsed = calcSaveSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError("invalid", "Revisá los datos del cálculo.");
    }

    try {
      const row = await saveCalcFlow(parsed.data, auth.user.id);
      revalidatePath("/admin/calculadora");
      return apiOk({ ok: true, id: row.id });
    } catch (error) {
      if (error instanceof AppError) {
        return apiError(
          error.code === "NOT_FOUND" ? "not_found" : "invalid",
          error.message,
        );
      }
      throw error;
    }
  },
);
