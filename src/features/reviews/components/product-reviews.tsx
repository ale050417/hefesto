import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReviewForm } from "./review-form";
import { Stars } from "./stars";
import type { Review, ReviewStats } from "../types";

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

export function ProductReviews({
  productId,
  slug,
  stats,
  items,
  canReview,
  alreadyReviewed,
}: {
  productId: string;
  slug: string;
  stats: ReviewStats;
  items: Review[];
  canReview: boolean;
  alreadyReviewed: boolean;
}) {
  return (
    <section className="mt-16">
      <div className="sec-head">
        <div>
          <div className="eyebrow">Opiniones</div>
          <h2 className="sec-title">Reseñas</h2>
          {stats.count > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <Stars value={stats.average} />
              <span className="text-dim text-sm">
                {stats.average} · {stats.count}{" "}
                {stats.count === 1 ? "reseña" : "reseñas"}
              </span>
            </div>
          ) : (
            <div className="sec-sub">Todavía no hay reseñas.</div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-dim text-sm">Sé el primero en opinar.</p>
          ) : (
            items.map((r) => (
              <div key={r.id} className="ui-card p-4">
                <div className="mb-1 flex items-center justify-between">
                  <b className="text-fg text-sm">{r.authorName ?? "Cliente"}</b>
                  <span className="text-faint text-xs">
                    {dateFmt.format(r.createdAt)}
                  </span>
                </div>
                <Stars value={r.rating} size={14} />
                {r.comment ? (
                  <p className="text-dim mt-2 text-sm">{r.comment}</p>
                ) : null}
              </div>
            ))
          )}
        </div>

        <aside>
          {!canReview ? (
            <div className="ui-card p-4 text-sm">
              <p className="text-dim mb-3">
                Iniciá sesión para dejar tu reseña.
              </p>
              <Link
                href={`/ingresar?redirect=/producto/${slug}`}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                )}
              >
                Ingresar
              </Link>
            </div>
          ) : alreadyReviewed ? (
            <div className="ui-card text-dim p-4 text-sm">
              Ya dejaste tu reseña en este producto. ¡Gracias!
            </div>
          ) : (
            <ReviewForm productId={productId} slug={slug} />
          )}
        </aside>
      </div>
    </section>
  );
}
