"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { createCategoryAction, updateCategoryAction } from "../actions";
import { CAT_COLORS, CAT_ICONS, catIconPath } from "../category-icons";
import { runAction } from "@/lib/run-action";

export type CategoryFormData = {
  id?: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  parentId?: string | null;
};

/** Opción de padre para el select (solo categorías raíz). */
export type ParentOption = { id: string; name: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function IconSvg({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
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

export function CategoryForm({
  category,
  parents = [],
  defaultParentId,
  onDone,
  onCancel,
}: {
  category?: CategoryFormData;
  /** Categorías raíz elegibles como padre (sin la propia). */
  parents?: ParentOption[];
  /** Padre preseleccionado al crear desde el "+ Sub" de una tarjeta. */
  defaultParentId?: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const edit = !!category?.id;
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<string>(category?.icon ?? CAT_ICONS[0]);
  const [color, setColor] = useState<string>(category?.color ?? CAT_COLORS[0]!);
  const [parentId, setParentId] = useState<string>(
    category?.parentId ?? defaultParentId ?? "",
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parentOptions = parents.filter((c) => c.id !== category?.id);

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Ingresá un nombre");
    setBusy(true);
    const payload = {
      name: name.trim(),
      slug: edit && category?.slug ? category.slug : slugify(name),
      icon,
      color,
      sortOrder: String(category?.sortOrder ?? 0),
      parentId: parentId || null,
    };
    try {
      const res =
        edit && category?.id
          ? await runAction(
              () => updateCategoryAction(category!.id!, payload),
              { silent: true },
            )
          : await runAction(() => createCategoryAction(payload), {
              silent: true,
            });
      if (!res.ok) return setErr(res.error.message);
      toast(edit ? "Categoría actualizada" : "Categoría creada", "success");
      onDone?.();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="kpi-ic"
          style={{
            width: 54,
            height: 54,
            background: `${color}22`,
            color: color,
          }}
        >
          <IconSvg name={icon} />
        </div>
        <div className="field grow">
          <label htmlFor="cat-name">Nombre de la categoría</label>
          <input
            id="cat-name"
            className="input"
            placeholder="Ej: Decoración"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cat-parent">Categoría padre (opcional)</label>
        <select
          id="cat-parent"
          className="input"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">— Ninguna (categoría raíz) —</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-faint mt-1 text-[11.5px]">
          Un solo nivel: las subcategorías no pueden tener hijas.
        </p>
      </div>

      <div className="field">
        <label>Ícono</label>
        <div className="flex flex-wrap gap-2">
          {CAT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              className={`icon-pick${icon === ic ? "on" : ""}`}
              onClick={() => setIcon(ic)}
              aria-label={ic}
            >
              <IconSvg name={ic} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Color</label>
        <div className="flex flex-wrap gap-2">
          {CAT_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              className={`color-pick${color === col ? "on" : ""}`}
              style={{ background: col }}
              onClick={() => setColor(col)}
              aria-label={col}
            />
          ))}
        </div>
      </div>

      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} loading={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Crear categoría"}
        </Button>
      </div>
    </div>
  );
}
