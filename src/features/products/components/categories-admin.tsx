"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { deleteCategoryAction } from "../actions";
import { catIconPath } from "../category-icons";
import type { CategoryWithCount } from "../types";
import { CategoryForm, type CategoryFormData } from "./category-form";
import { runAction } from "@/lib/run-action";

function IconSvg({ name, size }: { name: string | null; size?: number }) {
  return (
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
      dangerouslySetInnerHTML={{ __html: catIconPath(name) }}
    />
  );
}

const EditIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);

export function CategoriesAdmin({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  const router = useRouter();
  // Subcategorías (Fase 6): mostramos cada raíz seguida de sus hijas.
  const roots = categories.filter((c) => !c.parentId);
  const byParent = new Map<string, CategoryWithCount[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const ordered = roots.flatMap((r) => [r, ...(byParent.get(r.id) ?? [])]);
  const parentName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? null) : null;
  const parentOptions = roots.map(({ id, name }) => ({ id, name }));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryFormData | null>(null);
  const [toDelete, setToDelete] = useState<CategoryWithCount | null>(null);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(c: CategoryWithCount) {
    setEditing({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
      parentId: c.parentId,
    });
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    const res = await runAction(() => deleteCategoryAction(toDelete.id), {
      silent: true,
    });
    setBusy(false);
    if (res.ok) {
      toast("Categoría eliminada", "danger");
      setToDelete(null);
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Catálogo</div>
          <h1 className="page-title">Categorías</h1>
          <div className="page-sub">
            {categories.length} categorías · se muestran en el home y se eligen
            al crear productos
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-dim">No hay categorías. Creá la primera.</div>
        </div>
      ) : (
        <div className="grid-3">
          {ordered.map((c) => {
            const color = c.color ?? "#888";
            return (
              <div
                key={c.id}
                className="ui-card card-hover"
                style={{ padding: 0, overflow: "hidden" }}
              >
                <div style={{ height: 6, background: color }} />
                <div style={{ padding: 18 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="kpi-ic"
                        style={{
                          width: 46,
                          height: 46,
                          background: `${color}22`,
                          color,
                        }}
                      >
                        <IconSvg name={c.icon} size={21} />
                      </div>
                      <div>
                        <div className="text-[16px] font-bold">{c.name}</div>
                        <div className="text-faint text-[12px]">
                          {c.productCount}{" "}
                          {c.productCount === 1 ? "producto" : "productos"}
                          {parentName(c.parentId) ? (
                            <span
                              className="ml-1 rounded-full px-2 py-0.5 text-[11px]"
                              style={{
                                background: "rgba(var(--gold-rgb), .12)",
                                color: "var(--gold-deep)",
                              }}
                            >
                              Sub de {parentName(c.parentId)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-icon btn-ghost"
                        title="Editar"
                        onClick={() => openEdit(c)}
                      >
                        {EditIcon}
                      </button>
                      <button
                        className="btn-icon btn-ghost"
                        title="Eliminar"
                        onClick={() => setToDelete(c)}
                      >
                        {TrashIcon}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar categoría" : "Nueva categoría"}
        size="lg"
      >
        <CategoryForm
          category={editing ?? undefined}
          parents={parentOptions}
          onDone={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)}>
        {toDelete ? (
          <div className="p-2 text-center">
            <div
              className="kpi-ic mx-auto"
              style={{
                width: 54,
                height: 54,
                marginBottom: 16,
                background: "rgba(217,106,90,.12)",
                color: "var(--danger)",
              }}
            >
              {TrashIcon}
            </div>
            <div className="section-title mb-2">
              ¿Eliminar &quot;{toDelete.name}&quot;?
            </div>
            <div className="muted mx-auto max-w-[340px] text-[13.5px]">
              {toDelete.productCount > 0
                ? `No se puede borrar: tiene ${toDelete.productCount} producto(s). Reasignalos primero.`
                : "No se puede deshacer."}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setToDelete(null)}
              >
                {toDelete.productCount > 0 ? "Cerrar" : "Cancelar"}
              </Button>
              {toDelete.productCount === 0 ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={confirmDelete}
                >
                  {busy ? "Eliminando…" : "Eliminar"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
