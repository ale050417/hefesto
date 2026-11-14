import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { isAdminForUser } from "@/core/auth/permissions";
import { AppError } from "@/core/errors";
import { breakdownToJson } from "@/features/calculator/calc-payload";
import {
  quoteBreakdownFlow,
  quoteFinalPriceFlow,
} from "@/features/calculator/flows";
import { quotePriceSchema } from "@/features/calculator/schemas";

/**
 * POST /api/v1/admin/calculadora/cotizar — calcula el costo y el precio de una
 * pieza con los MISMOS cálculos de `calculator.ts` (`computeQuote`), en el
 * servidor (2026-10-31). La app lo llama con debounce mientras se tipea; no
 * reimplementa la matemática. Permiso calculadora/ver (como `quotePriceAction`).
 * Body: { presetId, filamentId, grams, hours }.
 *  - ADMIN: desglose completo (material, electricidad, desgaste, margen de
 *    error, costo total, ganancia, precio final, margen del tipo).
 *  - OPERADOR: SOLO { precioFinal } (el margen nunca sale del servidor).
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/calculadora/cotizar",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "calculadora", "ver");
    if ("response" in auth) return auth.response;

    const parsed = quotePriceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError("invalid", "Elegí un tipo de producto y un filamento.");
    }

    try {
      if (await isAdminForUser(auth.user)) {
        const { quote, marginPct, costPerKg } = await quoteBreakdownFlow(
          parsed.data,
        );
        return apiOk({
          detail: true,
          ...breakdownToJson(quote, marginPct, costPerKg),
        });
      }
      const { precioFinal } = await quoteFinalPriceFlow(parsed.data);
      return apiOk({ detail: false, precioFinal });
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
