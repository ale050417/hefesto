import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { Badge } from "@/components/ui/badge";
import { ReviewModeration } from "@/features/reviews/components/review-moderation";
import { Stars } from "@/features/reviews/components/stars";
import { listReviewsForModeration } from "@/features/reviews/service";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reseñas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

export default async function ResenasPage() {
  await requirePermissionPage("resenas", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const reviewsR = await safeLoad("reseñas", listReviewsForModeration(), []);
  const reviews = reviewsR.value;
  const pending = reviews.filter((r) => !r.isApproved).length;

  return (
    <div>
      <DegradedNotice sources={reviewsR.ok ? [] : ["las reseñas"]} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Comunidad</div>
          <h1 className="page-title">Reseñas</h1>
          <div className="page-sub">{pending} pendientes de aprobación</div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="space-y-3">
          <div className="ui-card text-dim p-4 text-sm">
            Todavía no hay reseñas de clientes. Cuando las haya, las moderás acá
            (aprobar u ocultar) y las aprobadas se ven en la ficha del producto.
            Así se ve una reseña:
          </div>
          <div className="ui-card p-4" style={{ opacity: 0.9 }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <b className="text-fg text-sm">Camila R.</b>
                  <Stars value={5} size={13} />
                  <span className="badge">Ejemplo</span>
                </div>
                <div className="text-faint mt-0.5 text-xs">
                  Lámpara Lunar · {dateFmt.format(new Date())}
                </div>
                <p className="text-dim mt-2 text-sm">
                  &ldquo;Quedó hermosa, la calidad de impresión es impecable y
                  llegó súper rápido. ¡Ya encargué otra!&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="ui-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <b className="text-fg text-sm">
                      {r.authorName ?? "Cliente"}
                    </b>
                    <Stars value={r.rating} size={13} />
                    {r.isApproved ? (
                      <Badge variant="success">Publicada</Badge>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                  </div>
                  <div className="text-faint mt-0.5 text-xs">
                    {r.productName ?? "—"} · {dateFmt.format(r.createdAt)}
                  </div>
                  {r.comment ? (
                    <p className="text-dim mt-2 text-sm">{r.comment}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <ReviewModeration id={r.id} isApproved={r.isApproved} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
