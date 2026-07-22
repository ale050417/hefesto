"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import {
  createCategoryAction,
  updateCategoryAction,
  uploadCategoryImageAction,
} from "../actions";
import { CAT_COLORS, CAT_ICONS, catIconPath } from "../category-icons";
import { runAction } from "@/lib/run-action";
import { compressImageToWebp } from "@/lib/image-compress";
import { useFormErrors } from "@/hooks/use-form-errors";

export type CategoryFormData = {
  id?: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  parentId?: string | null;
  imageUrl?: string | null;
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
  const [imageUrl, setImageUrl] = useState<string | null>(
    category?.imageUrl ?? null,
  );
  const [imgBusy, setImgBusy] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fe = useFormErrors();
  const parentOptions = parents.filter((c) => c.id !== category?.id);

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !category?.id) return;
    setImgBusy(true);
    // Comprimimos a WebP en el navegador (igual que logo/hero/productos) para
    // no chocar con el límite del Server Action.
    const compact = await compressImageToWebp(file, 1200);
    const fd = new FormData();
    fd.set("categoryId", category.id);
    fd.set("file", compact);
    const res = await runAction(() => uploadCategoryImageAction(fd), {
      silent: true,
    });
    setImgBusy(false);
    if (imgInputRef.current) imgInputRef.current.value = "";
    if (!res.ok) {
      toast(res.error.message, "danger");
      return;
    }
    setImageUrl(res.data.url);
    toast("Imagen actualizada", "success");
  }

  async function submit() {
    setErr(null);
    if (!fe.check({ name: !name.trim() ? "Ingresá un nombre." : null })) return;
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
      if (!res.ok) return fe.fromAction(res.error);
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
      {/* Vista previa: así se ve el círculo en el home, en vivo. */}
      <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-4">
        <span className="text-faint text-[10.5px] font-semibold tracking-wide uppercase">
          Vista previa
        </span>
        <span
          className="cat-circle-ring"
          style={{ "--cc": color } as CSSProperties}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              width={90}
              height={90}
              className="h-full w-full object-cover"
            />
          ) : (
            <IconSvg name={icon} />
          )}
        </span>
        <span className="cat-circle-name">{name.trim() || "Categoría"}</span>
      </div>

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
        <div className={`field grow ${fe.errors.name ? "invalid" : ""}`}>
          <label htmlFor="cat-name">Nombre de la categoría</label>
          <input
            id="cat-name"
            className="input"
            placeholder="Ej: Decoración"
            aria-invalid={!!fe.errors.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {fe.errors.name ? (
            <p className="field-error">{fe.errors.name}</p>
          ) : null}
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

      <div className="field">
        <label>Imagen de la categoría (opcional)</label>
        {edit ? (
          <div className="flex items-center gap-3">
            <div
              className="bg-surface-2 border-surface-3 relative overflow-hidden rounded-lg border"
              style={{ width: 84, height: 84, flexShrink: 0 }}
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  sizes="84px"
                  className="object-cover"
                />
              ) : (
                <span className="text-faint absolute inset-0 flex items-center justify-center text-[11px]">
                  Sin foto
                </span>
              )}
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <input
                ref={imgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickImage}
                disabled={imgBusy}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={imgBusy}
                onClick={() => imgInputRef.current?.click()}
              >
                {imageUrl ? "Cambiar imagen" : "Subir imagen"}
              </Button>
              <p className="text-faint text-[11.5px]">
                Se muestra en la tarjeta. Si no cargás, se usa el ícono.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-faint text-[12px]">
            Guardá la categoría y volvé a abrirla para subir una imagen.
          </p>
        )}
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
          {edit ? "Guardar" : "Crear categoría"}
        </Button>
      </div>
    </div>
  );
}
