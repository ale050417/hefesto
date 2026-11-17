"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoPicker } from "@/features/products/components/photo-picker";
import { compressImageToWebp } from "@/lib/image-compress";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { createInquiryAction, uploadInquiryImageAction } from "../actions";
import { MAX_INQUIRY_IMAGES } from "../schemas";

type Picked = { key: string; file: File; url: string };

/**
 * Alta de una consulta (atención al cliente): quién pregunta, qué pide y las
 * fotos de referencia que mandó. Primero se guarda la consulta y después se
 * suben las fotos de a una, igual que en Arreglos.
 */
export function InquiryForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
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
      const room = MAX_INQUIRY_IMAGES - prev.length;
      if (files.length > room) {
        toast(`Máximo ${MAX_INQUIRY_IMAGES} fotos por consulta.`, "danger");
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

  // Pegar con Ctrl+V la foto que mandó el cliente por WhatsApp Web.
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
        () =>
          createInquiryAction({
            customerName,
            customerPhone,
            title,
            description,
            quantity,
          }),
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
        fd.set("inquiryId", res.data.id);
        fd.set("file", compact);
        const up = await runAction(() => uploadInquiryImageAction(fd), {
          label: `Subiendo foto ${i + 1} de ${photos.length}…`,
          silent: true,
        });
        if (!up.ok) failed += 1;
      }
      if (failed > 0) {
        toast(
          `La consulta se guardó, pero ${failed} foto${failed === 1 ? " no se subió" : "s no se subieron"}.`,
          "danger",
        );
      } else {
        toast("Consulta enviada al operador", "success");
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const full = photos.length >= MAX_INQUIRY_IMAGES;

  return (
    <div className="flex flex-col gap-4" onPaste={onPaste}>
      {formError ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}

      <div className="grid-2">
        <div className={`field ${errors.customerName ? "invalid" : ""}`}>
          <label htmlFor="inq-customer">Cliente</label>
          <input
            id="inq-customer"
            className="input"
            value={customerName}
            maxLength={120}
            placeholder="Nombre de quien consulta"
            aria-invalid={errors.customerName ? true : undefined}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          {errors.customerName ? (
            <p className="field-error">{errors.customerName}</p>
          ) : null}
        </div>
        <div className={`field ${errors.customerPhone ? "invalid" : ""}`}>
          <label htmlFor="inq-phone">WhatsApp (opcional)</label>
          <input
            id="inq-phone"
            className="input"
            type="tel"
            inputMode="tel"
            value={customerPhone}
            maxLength={40}
            placeholder="Ej.: 3757 123456"
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          {errors.customerPhone ? (
            <p className="field-error">{errors.customerPhone}</p>
          ) : null}
        </div>
      </div>

      <div className="grid-2">
        <div className={`field ${errors.title ? "invalid" : ""}`}>
          <label htmlFor="inq-title">¿Qué pide?</label>
          <input
            id="inq-title"
            className="input"
            value={title}
            maxLength={160}
            placeholder="Ej.: llavero con el logo del club"
            aria-invalid={errors.title ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </div>
        <div className={`field ${errors.quantity ? "invalid" : ""}`}>
          <label htmlFor="inq-qty">Cantidad</label>
          <input
            id="inq-qty"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            value={quantity}
            aria-invalid={errors.quantity ? true : undefined}
            onChange={(e) => setQuantity(e.target.value)}
          />
          {errors.quantity ? (
            <p className="field-error">{errors.quantity}</p>
          ) : null}
        </div>
      </div>

      <div className={`field ${errors.description ? "invalid" : ""}`}>
        <label htmlFor="inq-description">Detalles para el operador</label>
        <textarea
          id="inq-description"
          className="textarea"
          rows={4}
          value={description}
          maxLength={4000}
          placeholder="Tamaño, colores, para cuándo lo necesita, lo que haya dicho el cliente."
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors.description ? (
          <p className="field-error">{errors.description}</p>
        ) : null}
      </div>

      <div className="field">
        <label>
          Fotos de referencia ({photos.length}/{MAX_INQUIRY_IMAGES})
        </label>
        <PhotoPicker
          multiple
          title={full ? "Ya están todas las fotos" : "Sumar fotos"}
          hint="Arrastrá, elegí o pegá con Ctrl+V lo que mandó el cliente."
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
          Enviar al operador
        </button>
      </div>
    </div>
  );
}
