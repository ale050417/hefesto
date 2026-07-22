"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { compressImageToWebp } from "@/lib/image-compress";
import { saveGalleryAction, uploadGalleryImageAction } from "../actions";

type GalleryItem = { url: string };

/**
 * Galería curada del home: el dueño sube sus mejores fotos de impresiones.
 * Cada alta/baja se guarda al instante (como los banners). Siempre va incrustado
 * dentro de un SectionCard, así que no lleva tarjeta/título propios.
 */
export function GalleryEditor({
  initial,
  onSaved,
}: {
  initial: GalleryItem[] | null;
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function persist(next: GalleryItem[]): Promise<boolean> {
    const res = await runAction(() => saveGalleryAction({ items: next }), {
      silent: true,
    });
    if (!res.ok) {
      toast(res.error.message, "danger");
      return false;
    }
    onSaved?.();
    return true;
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (items.length >= 12) {
      toast("Máximo 12 fotos.", "danger");
      return;
    }
    setBusy(true);
    // Comprimimos en el navegador para no chocar el límite del Server Action.
    const compact = await compressImageToWebp(file, 1200);
    const fd = new FormData();
    fd.set("file", compact);
    const res = await runAction(() => uploadGalleryImageAction(fd), {
      silent: true,
    });
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      setBusy(false);
      toast(res.error.message, "danger");
      return;
    }
    const next = [...items, { url: res.data.url }];
    setItems(next);
    await persist(next);
    setBusy(false);
    toast("Foto agregada", "success");
  }

  async function remove(i: number) {
    const next = items.filter((_, j) => j !== i);
    setItems(next);
    if (await persist(next)) toast("Foto quitada", "success");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-faint text-[12.5px] leading-relaxed">
        Subí tus mejores fotos de impresiones (hasta 12). Se muestran en la
        galería del home. Quedan mejor fotos parejas (cuadradas).
      </p>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={it.url}
              className="relative overflow-hidden rounded-md border border-[var(--border)]"
              style={{ aspectRatio: "1 / 1" }}
            >
              <Image
                src={it.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Quitar foto"
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.6)",
                  color: "#fff",
                  fontSize: 12,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-faint text-[12px]">Todavía no subiste fotos.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
        disabled={busy}
      />
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy || items.length >= 12}
        >
          {busy ? "Subiendo…" : "+ Subir foto"}
        </Button>
      </div>
    </div>
  );
}
