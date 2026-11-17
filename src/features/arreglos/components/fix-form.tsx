"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoPicker } from "@/features/products/components/photo-picker";
import { compressImageToWebp } from "@/lib/image-compress";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { createFixAction, uploadFixImageAction } from "../actions";
import { MAX_FIX_IMAGES } from "../schemas";

type Picked = { key: string; file: File; url: string };

/**
 * Alta de un arreglo (pedido de Ale, 2026-11-17): qué hay que arreglar, la
 * explicación y las fotos. Primero se guarda el arreglo y después se suben las
 * fotos de a una (el tope de las Server Actions es por request), así una foto
 * que falla no se lleva puesto el texto.
 */
export function FixForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Liberar las miniaturas al cerrar el formulario.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.url);
    },
    [],
  );

  function addPhotos(files: File[]) {
    setPhotos((prev) => {
      const room = MAX_FIX_IMAGES - prev.length;
      if (files.length > room) {
        toast(`Máximo ${MAX_FIX_IMAGES} fotos por arreglo.`, "danger");
      }
      const added = files.slice(0, Math.max(0, room)).map((file) => ({
        key: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      }));
      return [...prev, ...added];
    });
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.key !== key);
    });
  }

  // Pegar una captura con Ctrl+V: lo más común al reportar algo de la web.
  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      /^image\/(jpeg|png|webp)$/.test(f.type),
    );
    if (files.length === 0) return;
    e.preventDefault();
    addPhotos(files);
  }

  async function submit() {
    if (busy) return;
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const res = await runAction(
        () => createFixAction({ title, description, urgent }),
        { label: "Guardando…", silent: true },
      );
      if (!res.ok) {
        setErrors(res.error.fields ?? {});
        setFormError(res.error.fields ? null : res.error.message);
        return;
      }
      let failed = 0;
      for (const [i, p] of photos.entries()) {
        const compact = await compressImageToWebp(p.file, 1600);
        const fd = new FormData();
        fd.set("fixId", res.data.id);
        fd.set("file", compact);
        const up = await runAction(() => uploadFixImageAction(fd), {
          label: `Subiendo foto ${i + 1} de ${photos.length}…`,
          silent: true,
        });
        if (!up.ok) failed += 1;
      }
      if (failed > 0) {
        toast(
          `El arreglo se guardó, pero ${failed} foto${failed === 1 ? " no se subió" : "s no se subieron"}.`,
          "danger",
        );
      } else {
        toast("Arreglo enviado", "success");
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const full = photos.length >= MAX_FIX_IMAGES;

  return (
    <div className="flex flex-col gap-4" onPaste={onPaste}>
      {formError ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}

      <div className={`field ${errors.title ? "invalid" : ""}`}>
        <label htmlFor="fix-title">¿Qué hay que arreglar?</label>
        <input
          id="fix-title"
          className="input"
          value={title}
          maxLength={120}
          placeholder="Ej.: el botón de pagar no se ve en el celular"
          aria-invalid={errors.title ? true : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title ? <p className="field-error">{errors.title}</p> : null}
      </div>

      <div className={`field ${errors.description ? "invalid" : ""}`}>
        <label htmlFor="fix-description">Explicación</label>
        <textarea
          id="fix-description"
          className="textarea"
          rows={5}
          value={description}
          maxLength={4000}
          placeholder="Dónde pasa, qué esperabas que pase y cómo te gustaría que quede."
          aria-invalid={errors.description ? true : undefined}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors.description ? (
          <p className="field-error">{errors.description}</p>
        ) : null}
      </div>

      <div className="field">
        <label>
          Fotos o capturas ({photos.length}/{MAX_FIX_IMAGES})
        </label>
        <PhotoPicker
          multiple
          title={full ? "Ya están todas las fotos" : "Sumar fotos"}
          hint="Arrastrá, elegí o pegá una captura con Ctrl+V."
          cta="Elegir fotos"
          cameraCta="Sacar foto"
          disabled={busy || full}
          onPick={addPhotos}
        />
        {photos.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.key} className="media-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="object-cover" />
                <div className="media-actions">
                  <button
                    type="button"
                    className="media-act is-danger"
                    aria-label="Quitar foto"
                    disabled={busy}
                    onClick={() => removePhoto(p.key)}
                  >
                    ✕
                  </button>
                </div>
              </figure>
            ))}
          </div>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
        />
        Es urgente (frena ventas o el trabajo del día)
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          Enviar arreglo
        </button>
      </div>
    </div>
  );
}
