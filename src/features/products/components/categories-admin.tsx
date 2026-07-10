"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction } from "../actions";
import { catIconPath } from "../category-icons";
import type { CategoryWithCount } from "../types";
import { CategoryForm, type CategoryFormData } from "./category-form";
import { useDeleteResource } from "@/hooks/use-delete-resource";

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
  // Subcategorías (Fase 6): mostramos cada raíz seguida de sus hijas.
  const roots = categories.filter((c) => !c.parentId);
  const byParent = new Map<string, CategoryWithCount[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const parentOptions = roots.map(({ id, name }) => ({ id, name }));
  const subCount = categories.length - roots.length;
  const totalProducts = categories.reduce((acc, c) => acc + c.productCount, 0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryFormData | null>(null);
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CategoryWithCount | null>(null);

  function openNew() {
    setEditing(null);
    setNewParentId(null);
    setFormOpen(true);
  }
  function openNewChild(parentId: string) {
    setEditing(null);
    setNewParentId(parentId);
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

  // Patrón único de eliminación (modo toast: el confirm es el modal propio).
  const { deleteResource: removeCategory, deleting: deletingCategory } =
    useDeleteResource({
      action: (id: string) => deleteCategoryAction(id),
      successMessage: "Categoría eliminada",
      notify: "toast",
      onDeleted: () => setToDelete(null),
    });

  async function confirmDelete() {
    if (!toDelete) return;
    await removeCategory(toDelete.id);
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
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">
              {roots.length} categoría{roots.length === 1 ? "" : "s"}
            </span>
            <span className="chip">
              {subCount} subcategoría{subCount === 1 ? "" : "s"}
            </span>
            <span className="chip">
              {totalProducts} producto{totalProducts === 1 ? "" : "s"}{" "}
              categorizados
            </span>
          </div>

          <div className="grid-3" style={{ alignItems: "start" }}>
            {roots.map((c) => {
              const color = c.color ?? "#888";
              const children = byParent.get(c.id) ?? [];
              return (
                <div
                  key={c.id}
                  className="ui-card card-hover"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  {/* Cabecera tintada con el color de la categoría */}
                  <div
                    style={{
                      padding: "16px 18px 14px",
                      background: `linear-gradient(135deg, ${color}2e, ${color}0a 55%, transparent)`,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="kpi-ic shrink-0"
                          style={{
                            width: 48,
                            height: 48,
                            background: `${color}26`,
                            color,
                            boxShadow: `0 0 0 1px ${color}33`,
                          }}
                        >
                          <IconSvg name={c.icon} size={22} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[16.5px] font-bold">
                            {c.name}
                          </div>
                          <div className="text-faint text-[12px]">
                            {c.productCount}{" "}
                            {c.productCount === 1 ? "producto" : "productos"}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          className="btn-icon btn-ghost"
                          title="Editar"
                          onClick={() => openEdit(c)}
                        >
                          {EditIcon}
                        </button>
                        <button
                          className="btn-icon btn-ghost"
                          title={
                            children.length > 0
                              ? "Tiene subcategorías: borralas primero"
                              : "Eliminar"
                          }
                          onClick={() => setToDelete(c)}
                        >
                          {TrashIcon}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subcategorías SIEMPRE visibles (preview total del árbol) */}
                  <div style={{ padding: "12px 18px 16px" }}>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-faint text-[11px] font-semibold"
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                        }}
                      >
                        Subcategorías
                        {children.length > 0 ? ` (${children.length})` : ""}
                      </span>
                      <button
                        type="button"
                        className="text-dim hover:text-fg flex items-center gap-1 text-[12px] font-medium"
                        title={`Nueva subcategoría de ${c.name}`}
                        onClick={() => openNewChild(c.id)}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          aria-hidden
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Sub
                      </button>
                    </div>

                    {children.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openNewChild(c.id)}
                        className="text-faint hover:text-dim mt-2 w-full rounded-lg py-2.5 text-[12px]"
                        style={{ border: "1px dashed var(--border)" }}
                      >
                        + Agregar la primera subcategoría
                      </button>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {children.map((child) => {
                          const childColor = child.color ?? color;
                          return (
                            <li
                              key={child.id}
                              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                              style={{
                                background: "var(--surface-2)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className="kpi-ic shrink-0"
                                  style={{
                                    width: 28,
                                    height: 28,
                                    background: `${childColor}22`,
                                    color: childColor,
                                  }}
                                >
                                  <IconSvg name={child.icon} size={14} />
                                </span>
                                <span className="truncate text-[13px] font-semibold">
                                  {child.name}
                                </span>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                                  style={{
                                    background: `${childColor}1e`,
                                    color: childColor,
                                  }}
                                >
                                  {child.productCount}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center">
                                <button
                                  className="btn-icon btn-ghost"
                                  title="Editar"
                                  onClick={() => openEdit(child)}
                                >
                                  {EditIcon}
                                </button>
                                <button
                                  className="btn-icon btn-ghost"
                                  title="Eliminar"
                                  onClick={() => setToDelete(child)}
                                >
                                  {TrashIcon}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editing
            ? "Editar categoría"
            : newParentId
              ? "Nueva subcategoría"
              : "Nueva categoría"
        }
        size="lg"
      >
        <CategoryForm
          category={editing ?? undefined}
          parents={parentOptions}
          defaultParentId={newParentId ?? undefined}
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
                  disabled={deletingCategory}
                  onClick={confirmDelete}
                >
                  {deletingCategory ? "Eliminando…" : "Eliminar"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
