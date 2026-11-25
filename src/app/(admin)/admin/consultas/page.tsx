import { requirePermissionPage } from "@/core/auth/permissions";
import { can } from "@/core/auth/permissions";
import { getCurrentUser } from "@/core/auth/session";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { safeLoad } from "@/lib/safe-load";
import { getEstimatorContext } from "@/features/calculator/service";
import { InquiryList } from "@/features/consultas/components/inquiry-list";
import { NuevaConsultaButton } from "@/features/consultas/components/nueva-consulta-button";
import { inquiryProduct } from "@/features/consultas/product-prefill";
import { listInquiries } from "@/features/consultas/queries";
import { toInquiryView } from "@/features/consultas/view";
import { DEFAULT_QUOTE_DEFAULTS } from "@/features/quotes/build-quote";
import { listProductsForSale } from "@/features/products/services/catalogService";
import { getQuoteDefaults } from "@/features/quotes/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});
const fmt = (iso: string | null) =>
  iso ? dateFmt.format(new Date(iso)) : null;

/**
 * Consultas (pedido de Ale, 2026-11-17): atención al cliente carga lo que
 * pide una persona, el operador responde con el precio y de ahí sale armado
 * el mensaje para el cliente; si acepta, se marca confirmada.
 */
export default async function ConsultasPage() {
  await requirePermissionPage("consultas", "ver");
  const [user, listR, defaultsR] = await Promise.all([
    getCurrentUser(),
    safeLoad("consultas", listInquiries(), []),
    safeLoad("cotización", getQuoteDefaults(), DEFAULT_QUOTE_DEFAULTS),
  ]);
  // La calculadora y los productos de la tienda (para rellenar la respuesta)
  // solo hacen falta para quien responde (el operador).
  const canAnswer = await can("consultas", "editar");
  const [estimatorR, productsR] = canAnswer
    ? await Promise.all([
        safeLoad("calculadora", getEstimatorContext(), null),
        safeLoad("productos", listProductsForSale(), []),
      ])
    : [null, null];
  const estimator = estimatorR?.value ?? null;
  const products = (productsR?.value ?? []).map(inquiryProduct);

  const rows = listR.value.map((row) => {
    const v = toInquiryView(row, user?.id ?? null);
    return {
      ...v,
      createdAt: fmt(v.createdAt) ?? "",
      answeredAt: fmt(v.answeredAt),
      confirmedAt: fmt(v.confirmedAt),
    };
  });

  return (
    <div className="view grid gap-5">
      <DegradedNotice sources={listR.ok ? [] : ["las consultas"]} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Antes del pedido</div>
          <h1 className="page-title">Consultas</h1>
          <div className="page-sub">
            Lo que pregunta la gente: se carga acá, el operador pone el precio y
            sale el mensaje listo para mandar
          </div>
        </div>
        <NuevaConsultaButton />
      </div>

      {rows.length === 0 && listR.ok ? (
        <div className="ui-card section-card text-dim p-10 text-center">
          Todavía no hay consultas cargadas.
        </div>
      ) : (
        <InquiryList
          inquiries={rows}
          defaults={defaultsR.value}
          estimator={estimator}
          products={products}
        />
      )}
    </div>
  );
}
