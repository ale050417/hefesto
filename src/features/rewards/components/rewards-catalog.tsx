"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { redeemRewardAction } from "../actions";
import { toast } from "@/stores/toastStore";

export type RewardItem = {
  id: string;
  type: "shipping" | "discount" | "product";
  title: string;
  description: string | null;
  costPoints: number;
  discountValue: number | null;
  discountIsPercent: boolean;
};

const TYPE_ICON: Record<RewardItem["type"], string> = {
  discount: "M20.6 13.4 12 22l-9-9V3h10z",
  shipping:
    "M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  product:
    "M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
};

function benefitText(r: RewardItem): string {
  if (r.type === "discount") {
    const v = Number(r.discountValue ?? 0);
    return r.discountIsPercent
      ? `${v}% de descuento`
      : `$${v.toLocaleString("es-AR")} de descuento`;
  }
  return r.type === "shipping" ? "Envío gratis" : "Producto de regalo";
}

export function RewardsCatalog({
  rewards,
  balance,
}: {
  rewards: RewardItem[];
  balance: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function redeem(r: RewardItem) {
    setBusy(r.id);
    setResult(null);
    const res = await redeemRewardAction(r.id);
    setBusy(null);
    if (!res.ok) {
      toast(res.error, "danger");
      return;
    }
    setResult(res.message);
    toast("¡Canjeado!", "success");
    router.refresh();
  }

  if (rewards.length === 0) return null;

  return (
    <section>
      <h2 className="text-fg font-display mb-1 text-lg font-bold">
        Canjeá tus puntos
      </h2>
      <p className="text-dim mb-4 text-sm">
        Tenés <b className="text-[var(--gold-bright)]">{balance}</b> puntos.
      </p>

      {result ? (
        <div className="bg-success/10 text-success mb-4 rounded-md px-3 py-3 text-sm">
          {result}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {rewards.map((r) => {
          const enough = balance >= r.costPoints;
          return (
            <div
              key={r.id}
              className="ui-card flex flex-col gap-2 p-4"
              style={{ opacity: enough ? 1 : 0.7 }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="kpi-ic"
                  style={{
                    background: "rgba(var(--gold-rgb),.14)",
                    color: "var(--gold)",
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={TYPE_ICON[r.type]} />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-fg text-[14px] font-semibold">
                    {r.title}
                  </div>
                  <div className="text-[12.5px] text-[var(--gold-bright)]">
                    {benefitText(r)}
                  </div>
                </div>
              </div>
              {r.description ? (
                <p className="text-dim text-[12.5px]">{r.description}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-faint text-[13px] font-semibold">
                  {r.costPoints} puntos
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!enough || busy === r.id}
                  onClick={() => redeem(r)}
                >
                  {busy === r.id
                    ? "Canjeando…"
                    : enough
                      ? "Canjear"
                      : `Faltan ${r.costPoints - balance}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
