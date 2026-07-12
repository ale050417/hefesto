"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import {
  addBrandAction,
  addColorAction,
  addMaterialAction,
  deleteBrandAction,
  deleteColorAction,
  deleteMaterialAction,
  saveFilamentAction,
} from "../actions";
import { runAction } from "@/lib/run-action";
import { FILAMENT_DIAMETERS } from "../constants";

export type FilamentFormData = {
  id?: string;
  material: string;
  color: string;
  brand: string;
  diameter: string;
  stockGrams: number;
  spoolGrams: number;
  costPerKg: number;
  alertThresholdGrams: number;
};

export type CatalogItem = { name: string; hex: string | null };

const DEFAULTS: FilamentFormData = {
  material: "PLA",
  color: "Negro",
  brand: "Grilon3",
  diameter: "1.75",
  stockGrams: 0,
  spoolGrams: 1000,
  costPerKg: 18000,
  alertThresholdGrams: 1000,
};

/** Une el catálogo con el valor actual (por si edito un filamento con un
 * color/marca viejo, de texto libre, que todavía no está en el catálogo). */
function withCurrent(items: string[], current: string): string[] {
  return [...new Set([current, ...items].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

export function FilamentForm({
  filament,
  colorCatalog,
  brandCatalog,
  materialCatalog,
  onDone,
  onCancel,
}: {
  filament?: FilamentFormData;
  colorCatalog: CatalogItem[];
  brandCatalog: CatalogItem[];
  materialCatalog: CatalogItem[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const edit = !!filament?.id;
  const init = filament ?? DEFAULTS;
  const [colors, setColors] = useState<CatalogItem[]>(colorCatalog);
  const [brands, setBrands] = useState<CatalogItem[]>(brandCatalog);
  const [materials, setMaterials] = useState<CatalogItem[]>(materialCatalog);
  const [form, setForm] = useState({
    material: init.material,
    color: init.color,
    brand: init.brand,
    diameter: init.diameter,
    stockGrams: String(init.stockGrams ?? 0),
    spoolGrams: String(init.spoolGrams ?? 1000),
    costPerKg: String(init.costPerKg ?? 0),
    alertThresholdGrams: String(init.alertThresholdGrams ?? 0),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Alta inline de color / marca (botón "＋"): quedan guardados en el catálogo.
  const [addingColor, setAddingColor] = useState(false);
  const [newColor, setNewColor] = useState({
    name: "",
    hex: "#C9A84C",
    hexText: "#C9A84C",
  });
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [deletingMaterial, setDeletingMaterial] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [deletingColor, setDeletingColor] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const colorOptions = withCurrent(
    colors.map((c) => c.name),
    form.color,
  );
  const brandOptions = withCurrent(
    brands.map((b) => b.name),
    form.brand,
  );
  const materialOptions = withCurrent(
    materials.map((m) => m.name),
    form.material,
  );
  const hexOf = (name: string) =>
    colors.find((c) => c.name === name)?.hex ?? "#888";

  async function addNewColor() {
    const name = newColor.name.trim();
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(
      () => addColorAction({ name, hex: newColor.hex }),
      { silent: true },
    );
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setColors((c) => [
      ...c.filter((x) => x.name !== name),
      { name, hex: newColor.hex },
    ]);
    set("color", name);
    setNewColor({ name: "", hex: "#C9A84C", hexText: "#C9A84C" });
    setAddingColor(false);
    toast("Color agregado al catálogo", "success");
  }

  async function addNewBrand() {
    const name = newBrand.trim();
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(() => addBrandAction({ name }), {
      silent: true,
    });
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setBrands((b) => [
      ...b.filter((x) => x.name !== name),
      { name, hex: null },
    ]);
    set("brand", name);
    setNewBrand("");
    setAddingBrand(false);
    toast("Marca agregada al catálogo", "success");
  }

  async function removeSelectedColor() {
    const name = form.color;
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(() => deleteColorAction(name), {
      silent: true,
    });
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    const rest = colors.filter((x) => x.name !== name);
    setColors(rest);
    set("color", rest[0]?.name ?? "");
    setDeletingColor(false);
    toast("Color eliminado del catálogo", "success");
  }

  async function removeSelectedBrand() {
    const name = form.brand;
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(() => deleteBrandAction(name), {
      silent: true,
    });
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    const rest = brands.filter((x) => x.name !== name);
    setBrands(rest);
    set("brand", rest[0]?.name ?? "");
    setDeletingBrand(false);
    toast("Marca eliminada del catálogo", "success");
  }

  async function addNewMaterial() {
    const name = newMaterial.trim();
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(() => addMaterialAction({ name }), {
      silent: true,
    });
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setMaterials((m) => [
      ...m.filter((x) => x.name !== name),
      { name, hex: null },
    ]);
    set("material", name);
    setNewMaterial("");
    setAddingMaterial(false);
    toast("Material agregado al catálogo", "success");
  }

  async function removeSelectedMaterial() {
    const name = form.material;
    if (!name) return;
    setSavingCat(true);
    const res = await runAction(() => deleteMaterialAction(name), {
      silent: true,
    });
    setSavingCat(false);
    if (!res.ok) return toast(res.error.message, "danger");
    const rest = materials.filter((x) => x.name !== name);
    setMaterials(rest);
    set("material", rest[0]?.name ?? "");
    setDeletingMaterial(false);
    toast("Material eliminado del catálogo", "success");
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await runAction(
        () => saveFilamentAction(form, filament?.id),
        { silent: true },
      );
      if (!res.ok) return setErr(res.error.message);
      toast(edit ? "Filamento actualizado" : "Filamento agregado", "success");
      onDone?.();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-mat">Material</label>
          <div className="flex items-center gap-2">
            <select
              id="fm-mat"
              className="select"
              value={form.material}
              onChange={(e) => set("material", e.target.value)}
            >
              {materialOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAddingMaterial((v) => !v);
                setDeletingMaterial(false);
              }}
              title="Agregar un material nuevo al catálogo"
            >
              ＋
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDeletingMaterial((v) => !v);
                setAddingMaterial(false);
              }}
              title="Eliminar del catálogo el material seleccionado"
              disabled={!form.material}
            >
              🗑
            </button>
          </div>
          {addingMaterial ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="input"
                placeholder="Nombre del material (ej. PLA Silk)"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
              />
              <Button
                type="button"
                onClick={addNewMaterial}
                loading={savingCat}
              >
                Agregar
              </Button>
            </div>
          ) : null}
          {deletingMaterial ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>
                ¿Eliminar <b>{form.material}</b> del catálogo?
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={removeSelectedMaterial}
                loading={savingCat}
              >
                Sí, eliminar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeletingMaterial(false)}
              >
                No
              </Button>
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="fm-color">Color</label>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: hexOf(form.color),
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            />
            <select
              id="fm-color"
              className="select"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
            >
              {colorOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAddingColor((v) => !v);
                setDeletingColor(false);
              }}
              title="Agregar un color nuevo al catálogo"
            >
              ＋
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDeletingColor((v) => !v);
                setAddingColor(false);
              }}
              title="Eliminar del catálogo el color seleccionado"
              disabled={!form.color}
            >
              🗑
            </button>
          </div>
          {addingColor ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="input"
                placeholder="Nombre del color"
                value={newColor.name}
                onChange={(e) =>
                  setNewColor((n) => ({ ...n, name: e.target.value }))
                }
              />
              <input
                type="color"
                value={newColor.hex}
                onChange={(e) =>
                  setNewColor((n) => ({
                    ...n,
                    hex: e.target.value,
                    hexText: e.target.value,
                  }))
                }
                title="Elegir el tono"
                style={{ width: 42, height: 38, padding: 2 }}
              />
              <input
                className="input"
                placeholder="#RRGGBB"
                value={newColor.hexText}
                onChange={(e) => {
                  const raw = e.target.value;
                  const clean = raw.trim().replace(/^#/, "");
                  const valid = /^[0-9a-fA-F]{6}$/.test(clean);
                  setNewColor((n) => ({
                    ...n,
                    hexText: raw,
                    hex: valid ? `#${clean}` : n.hex,
                  }));
                }}
                title="Código hexadecimal (ej. #FF5733)"
                style={{ maxWidth: 130 }}
              />
              <Button type="button" onClick={addNewColor} loading={savingCat}>
                Agregar
              </Button>
            </div>
          ) : null}
          {deletingColor ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>
                ¿Eliminar <b>{form.color}</b> del catálogo?
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={removeSelectedColor}
                loading={savingCat}
              >
                Sí, eliminar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeletingColor(false)}
              >
                No
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-brand">Marca</label>
          <div className="flex items-center gap-2">
            <select
              id="fm-brand"
              className="select"
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            >
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setAddingBrand((v) => !v);
                setDeletingBrand(false);
              }}
              title="Agregar una marca nueva al catálogo"
            >
              ＋
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setDeletingBrand((v) => !v);
                setAddingBrand(false);
              }}
              title="Eliminar del catálogo la marca seleccionada"
              disabled={!form.brand}
            >
              🗑
            </button>
          </div>
          {addingBrand ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                className="input"
                placeholder="Nombre de la marca"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              />
              <Button type="button" onClick={addNewBrand} loading={savingCat}>
                Agregar
              </Button>
            </div>
          ) : null}
          {deletingBrand ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>
                ¿Eliminar <b>{form.brand}</b> del catálogo?
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={removeSelectedBrand}
                loading={savingCat}
              >
                Sí, eliminar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeletingBrand(false)}
              >
                No
              </Button>
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="fm-dia">Diámetro (mm)</label>
          <select
            id="fm-dia"
            className="select"
            value={form.diameter}
            onChange={(e) => set("diameter", e.target.value)}
          >
            {FILAMENT_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-stock">Stock actual (g)</label>
          <input
            id="fm-stock"
            type="number"
            className="input"
            placeholder="0"
            value={form.stockGrams}
            onChange={(e) => set("stockGrams", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fm-spool">Tamaño del carrete (g)</label>
          <input
            id="fm-spool"
            type="number"
            className="input"
            placeholder="1000"
            value={form.spoolGrams}
            onChange={(e) => set("spoolGrams", e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-cost">Costo por kg</label>
          <input
            id="fm-cost"
            type="number"
            className="input"
            value={form.costPerKg}
            onChange={(e) => set("costPerKg", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fm-alert">Alerta de stock bajo (g)</label>
          <input
            id="fm-alert"
            type="number"
            className="input"
            value={form.alertThresholdGrams}
            onChange={(e) => set("alertThresholdGrams", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} loading={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Agregar filamento"}
        </Button>
      </div>
    </div>
  );
}
