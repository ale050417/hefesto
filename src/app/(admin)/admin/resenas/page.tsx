import { requirePermissionPage } from "@/core/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { ReviewModeration } from "@/features/reviews/components/review-moderation";
import { Stars } from "@/features/reviews/components/stars";
import { listForModeration } from "@/features/reviews/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reseñas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

export default async function ResenasPage() {
  await requirePermissionPage("resenas", "ver");
  const reviews = await listForModeration();
  const pending = reviews.filter((r) => !r.isApproved).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Comunidad</div>
          <h1 className="page-title">Reseñas</h1>
          <div className="page-sub">{pending} pendientes de aprobación</div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          Todavía no hay reseñas.
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
