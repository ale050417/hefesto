import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import { createInquiry } from "@/features/consultas/flow";
import { listInquiries } from "@/features/consultas/queries";
import {
  INQUIRY_STATUS_LABEL,
  MAX_INQUIRY_FILES,
  MAX_INQUIRY_IMAGES,
  PAYMENT_METHOD_LABEL,
  inquiryCreateSchema,
} from "@/features/consultas/schemas";
import { toInquiryView } from "@/features/consultas/view";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";

/**
 * /api/v1/admin/consultas — consultas de clientes (app móvil, 2026-11-17).
 * Mismo flujo que el panel web (features/consultas/flow.ts).
 *  - GET  → lista (consultas/ver).
 *  - POST → carga una consulta (consultas/crear). Las fotos se suben después
 *           a /consultas/:id/images, de a una.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/consultas", async (request: Request) => {
  const auth = await requireApiPerm(request, "consultas", "ver");
  if ("response" in auth) return auth.response;
  const rows = await listInquiries();
  return apiOk({
    items: rows.map((r) => toInquiryView(r, auth.user.id)),
    statuses: INQUIRY_STATUS_LABEL,
    maxImages: MAX_INQUIRY_IMAGES,
    maxFiles: MAX_INQUIRY_FILES,
    paymentMethods: PAYMENT_METHOD_LABEL,
  });
});

export const POST = withApi(
  "admin/consultas/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "consultas", "crear");
    if ("response" in auth) return auth.response;
    const parsed = inquiryCreateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const row = await createInquiry(parsed.data, apiActor(auth.user));
      return apiOk(toInquiryView(row, auth.user.id), { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
