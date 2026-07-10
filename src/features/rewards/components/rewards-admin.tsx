"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KpiCard } from "@/features/reports/components/kpi-card";
import { deleteRewardAction } from "../actions";
import { REWARD_TYPES, type RewardTypeKey } from "../reward-types";
import type { Reward } from "../service";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import {
  RewardForm,
  type ProductOption,
  type RewardFormData,
} from "./reward-form";

const ic = (path: string, size?: number) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

const EditIcon = ic(
  '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  17,
);
const TrashIcon = ic(
  '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>',
  17,
);

type Stats = {
  inCirculation: number;
  redemptions: number;
  pointsRedeemed: number;
};

export function RewardsAdmin({
  rewards,
  stats,
  products,
}: {
  rewards: Reward[];
  stats: Stats;
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RewardFormData | null>(null);
  const [toDelete, setToDelete] = useState<Reward | null>(null);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(r: Reward) {
    setEditing({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      costPoints: r.costPoints,
      discountValue: r.discountValue != null ? Number(r.discountValue) : null,
      discountIsPercent: r.discountIsPercent,
      productId: r.productId,
      isActive: r.isActive,
    });
    setOpen(true);
  }

  // Patrón único de eliminación (serializa, toast garantizado).
  const { deleteResource: removeReward } = useDeleteResource({
    action: (rewardId: string) => deleteRewardAction(rewardId),
    successMessage: "Recompensa eliminada",
  });

  async function confirmDelete() {
    if (!toDelete) return;
    await removeReward(toDelete.id);
  }

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Crecimiento · Fidelización</div>
          <h1 className="page-title">Recompensas</h1>
          <div className="page-sub">
            Definí qué puede canjear tu cliente y por cuántos puntos
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          {ic('<path d="M12 5v14M5 12h14"/>')}
          Nueva recompensa
        </button>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon={ic(
            '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
          )}
          label="Recompensas"
          value={String(rewards.length)}
          delta="catálogo"
          tint="#9B7BD4"
        />
        <KpiCard
          icon={ic(
            '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
          )}
          label="Puntos en circulación"
          value={String(stats.inCirculation)}
          delta="de clientes"
          tint="#C9A84C"
        />
        <KpiCard
          icon={ic('<path d="M20 6 9 17l-5-5"/>')}
          label="Canjes realizados"
          value={String(stats.redemptions)}
          delta="histórico"
          tint="#4CB782"
        />
        <KpiCard
          icon={ic('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>')}
          label="Puntos canjeados"
          value={String(stats.pointsRedeemed)}
          delta="total"
          tint="#5A9CD9"
        />
      </div>

      <div className="ui-card section-card">
        <div className="section-title mb-1.5">Catálogo de recompensas</div>
        <div className="text-faint mb-4 text-[12.5px]">
          Así las ve tu cliente en la sección &quot;Canjear puntos&quot;.
        </div>
        {rewards.length === 0 ? (
          <div className="text-dim py-6 text-center text-sm">
            Todavía no creaste recompensas.
          </div>
        ) : (
          <div className="grid-3">
            {[...rewards]
              .sort((a, b) => a.costPoints - b.costPoints)
              .map((r) => {
                const t = REWARD_TYPES[r.type as RewardTypeKey];
                return (
                  <div key={r.id} className="reward-card">
                    <div className="rw-top">
                      <span
                        className="rw-ic"
                        style={{ background: `${t.color}1f`, color: t.color }}
                      >
                        {ic(t.icon)}
                      </span>
                      <span className="rw-cost">
                        {r.costPoints} <span>pts</span>
                      </span>
                    </div>
                    <div className="rw-title">{r.title}</div>
                    <div className="rw-desc">{r.description ?? ""}</div>
                    <div className="flex items-center justify-between border-t border-[var(--border)] pt-2.5">
                      <span
                        className="badge"
                        style={{
                          color: t.color,
                          background: `${t.color}1a`,
                          borderColor: `${t.color}44`,
                        }}
                      >
                        {t.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-icon btn-ghost"
                          title="Editar"
                          onClick={() => openEdit(r)}
                        >
                          {EditIcon}
                        </button>
                        <button
                          className="btn-icon btn-ghost"
                          title="Eliminar"
                          onClick={() => setToDelete(r)}
                        >
                          {TrashIcon}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="ui-card text-faint flex items-start gap-3 p-4 text-[13px] leading-relaxed">
        <span className="text-[var(--gold-bright)]">
          {ic(
            '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
            18,
          )}
        </span>
        <p>
          Tus clientes ganan <b className="text-fg">1 punto por cada $100</b> en
          compras entregadas. (El canje de recompensas se habilitará
          próximamente en la cuenta del cliente.)
        </p>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar recompensa" : "Nueva recompensa"}
        size="lg"
      >
        <RewardForm
          reward={editing ?? undefined}
          products={products}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={
          toDelete ? `¿Eliminar "${toDelete.title}"?` : "¿Eliminar recompensa?"
        }
        description="Los clientes ya no podrán canjear esta recompensa."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
