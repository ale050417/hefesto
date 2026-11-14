import { revalidatePath } from "next/cache";
import { apiOk, withApi } from "@/core/api/respond";
import {
  emptyToNull,
  readBody,
  requireConfigEdit,
} from "@/features/settings/api-helpers";
import { pagosPatchSchema } from "@/features/settings/api-schemas";
import { serializePagos } from "@/features/settings/api-serialize";
import {
  getPaymentSettings,
  savePaymentSettings,
} from "@/features/settings/service";

/**
 * PUT /api/v1/admin/configuracion/pagos — medios de pago del checkout:
 * transferencia (alias y CBU), MercadoPago (activo y nota) y efectivo. Lo que
 * no viene queda como está. Permiso config/editar; mismos efectos que
 * `savePaymentSettingsAction`. El token de MercadoPago se maneja aparte
 * (`/pagos/mercadopago`) y nunca vuelve al celular.
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/configuracion/pagos",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;

    const body = await readBody(request, pagosPatchSchema, "Revisá los datos.");
    if ("response" in body) return body.response;
    const d = body.data;

    const current = serializePagos(await getPaymentSettings());
    await savePaymentSettings({
      transferEnabled: d.transferEnabled ?? current.transferEnabled,
      transferAlias: emptyToNull(d.transferAlias ?? current.transferAlias),
      transferCbu: emptyToNull(d.transferCbu ?? current.transferCbu),
      mpEnabled: d.mpEnabled ?? current.mpEnabled,
      mpNote: emptyToNull(d.mpNote ?? current.mpNote),
      cashEnabled: d.cashEnabled ?? current.cashEnabled,
      cashNote: emptyToNull(d.cashNote ?? current.cashNote),
    });
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
