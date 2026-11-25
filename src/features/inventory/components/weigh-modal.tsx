"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { saveSpoolModelAction, weighFilamentAction } from "../actions";
import type { SpoolModelView } from "../filament-types";
import type { FilamentView } from "../types";
import { planWeigh } from "../weigh";

const grams = (n: number) => `${Math.round(n * 100) / 100} g`;

/**
 * "Calcular filamento" (pedido de Agustín, 2026-11-24): se elige el modelo de
 * carrete, se pesa el carrete en uso y la página resta el peso del carrete
 * vacío. Al confirmar, ese pasa a ser el stock del color (queda en el
 * historial). Si el modelo de carrete no está cargado, se agrega acá mismo.
 */
export function WeighModal({
  filament,
  spoolModels,
  onClose,
}: {
  filament: FilamentView;
  spoolModels: SpoolModelView[];
  onClose: () => void;
}) {
  const [models, setModels] = useState(spoolModels);
  const [modelId, setModelId] = useState(
    () =>
      // El modelo con el que se pesó la última vez, si sigue existiendo.
      spoolModels.find((m) => m.id === filament.spoolModelId)?.id ??
      spoolModels[0]?.id ??
      "",
  );
  const [total, setTotal] = useState("");
  const [sealed, setSealed] = useState("");
  const [busy, setBusy] = useState(false);
  // Alta rápida de un modelo de carrete.
  const [adding, setAdding] = useState(spoolModels.length === 0);
  const [newName, setNewName] = useState("");
  const [newEmpty, setNewEmpty] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  const model = models.find((m) => m.id === modelId) ?? null;
  const totalN = Number(total.replace(",", "."));
  const sealedN = Math.max(0, Math.floor(Number(sealed) || 0));

  let plan: ReturnType<typeof planWeigh> | null = null;
  let problem: string | null = null;
  if (model && total.trim() !== "") {
    try {
      plan = planWeigh({
        totalGrams: totalN,
        emptyGrams: model.emptyGrams,
        sealedSpools: sealedN,
        spoolGrams: filament.spoolGrams,
      });
    } catch (error) {
      problem = error instanceof Error ? error.message : "Revisá el peso.";
    }
  }

  async function addModel() {
    const name = newName.trim();
    if (!name) return toast("Ponele un nombre al carrete.", "danger");
    if (newEmpty.trim() === "" || !(Number(newEmpty) >= 0)) {
      return toast("Ingresá cuánto pesa vacío.", "danger");
    }
    setSavingModel(true);
    const res = await runAction(
      () => saveSpoolModelAction(null, { name, emptyGrams: Number(newEmpty) }),
      { silent: true },
    );
    setSavingModel(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setModels((ms) => [
      ...ms,
      { id: res.data.id, name, emptyGrams: Number(newEmpty) },
    ]);
    setModelId(res.data.id);
    setNewName("");
    setNewEmpty("");
    setAdding(false);
    toast("Carrete agregado", "success");
  }

  async function confirm() {
    if (!model || !plan) return;
    setBusy(true);
    const res = await runAction(
      () =>
        weighFilamentAction(filament.id, {
          spoolModelId: model.id,
          totalGrams: totalN,
          sealedSpools: sealedN,
        }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast(
      res.data.changed
        ? `Stock actualizado: ${grams(res.data.newStockGrams)}`
        : `El stock ya era de ${grams(res.data.newStockGrams)}`,
      "success",
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Calcular filamento · ${filament.material} ${filament.color}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-faint text-[12.5px] leading-relaxed">
          Pesá el carrete que estás usando y poné el peso total. Se le resta lo
          que pesa el carrete vacío y te queda el filamento que hay.
        </p>

        <div className="field">
          <label htmlFor="wg-model">Modelo de carrete</label>
          {models.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                id="wg-model"
                className="select"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — vacío {grams(m.emptyGrams)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                title="Agregar un modelo de carrete"
                onClick={() => setAdding((v) => !v)}
              >
                ＋
              </button>
            </div>
          ) : (
            <p className="text-dim text-[12.5px]">
              Todavía no hay modelos de carrete cargados. Agregá el primero:
              pesá un carrete vacío y anotá cuánto pesa.
            </p>
          )}
          {adding ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="input"
                style={{ flex: "1 1 160px", minWidth: 0 }}
                placeholder="Nombre (ej. Bambu Lab plástico)"
                maxLength={60}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                min={0}
                placeholder="Vacío (g)"
                aria-label="Peso del carrete vacío en gramos"
                value={newEmpty}
                onChange={(e) => setNewEmpty(e.target.value)}
              />
              <Button type="button" onClick={addModel} loading={savingModel}>
                Agregar
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="wg-total">Peso del carrete con filamento (g)</label>
            <input
              id="wg-total"
              className="input"
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Ej: 680"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="wg-sealed">
              Carretes cerrados aparte (opcional)
            </label>
            <input
              id="wg-sealed"
              className="input"
              type="number"
              min={0}
              placeholder="0"
              value={sealed}
              onChange={(e) => setSealed(e.target.value)}
            />
          </div>
        </div>

        <div
          className="ui-card flex flex-col gap-1.5"
          style={{ padding: "12px 14px" }}
        >
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-dim">Carrete vacío</span>
            <b>{model ? grams(model.emptyGrams) : "—"}</b>
          </div>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-dim">Filamento restante</span>
            <b>{plan ? grams(plan.remainingGrams) : "—"}</b>
          </div>
          {sealedN > 0 ? (
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-dim">
                + {sealedN} carrete(s) cerrado(s) de{" "}
                {grams(filament.spoolGrams)}
              </span>
              <b>{grams(sealedN * filament.spoolGrams)}</b>
            </div>
          ) : null}
          <div
            className="mt-1 flex items-center justify-between border-t pt-2"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-[12.5px] font-semibold">
              Stock de este color
            </span>
            <b className="text-[16px]" style={{ color: "var(--gold-bright)" }}>
              {plan ? grams(plan.newStockGrams) : "—"}
            </b>
          </div>
          <div className="text-faint text-[11.5px]">
            Hoy figura {grams(Math.max(0, filament.stockGrams))}.
          </div>
          {problem ? (
            <div className="text-[12px]" style={{ color: "var(--danger)" }}>
              {problem}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirm}
            loading={busy}
            disabled={!plan}
          >
            Confirmar y actualizar stock
          </Button>
        </div>
      </div>
    </Modal>
  );
}
