"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  DRAFTS_EVENT,
  deleteProductDraft,
  draftAge,
  draftTitle,
  listProductDrafts,
  type ProductDraft,
} from "../product-drafts";
import type { Category } from "../types";

/**
 * "Borradores (n)" del alta de producto (pedido de Agustín, 2026-11-22): los
 * productos que quedaron a medio cargar en este navegador. Solo aparece si
 * hay alguno. "Continuar" lo abre donde había quedado.
 */
export function ProductDraftsButton({
  categories,
  onResume,
}: {
  categories: Category[];
  onResume: (draft: ProductDraft) => void;
}) {
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void listProductDrafts().then(setDrafts);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(DRAFTS_EVENT, refresh);
    return () => window.removeEventListener(DRAFTS_EVENT, refresh);
  }, [refresh]);

  if (drafts.length === 0) return null;

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? null;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        title="Productos que quedaron a medio cargar"
      >
        Borradores ({drafts.length})
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Borradores">
        <div className="flex flex-col gap-3">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Productos que quedaron a medio cargar en este dispositivo. Se
            guardan solos mientras cargás y se borran al crear el producto.
          </p>
          {drafts.map((d) => {
            const category = categoryName(d.data.categoryId);
            return (
              <div
                key={d.id}
                className="ui-card flex flex-wrap items-center justify-between gap-3"
                style={{ padding: "12px 14px" }}
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold break-words">
                    {draftTitle(d.data)}
                  </div>
                  <div className="text-faint text-[12px]">
                    {[
                      category,
                      d.data.price ? `$${d.data.price}` : null,
                      `guardado ${draftAge(d.updatedAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {confirmId === d.id ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span>¿Borrarlo?</span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setConfirmId(null);
                        void deleteProductDraft(d.id);
                      }}
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmId(d.id)}
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setOpen(false);
                        onResume(d);
                      }}
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
