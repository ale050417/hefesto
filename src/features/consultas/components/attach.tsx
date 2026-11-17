"use client";

import { useRef, useState } from "react";
import { compressImageToWebp } from "@/lib/image-compress";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { uploadInquiryFileAction, uploadInquiryImageAction } from "../actions";
import { MAX_INQUIRY_FILE_BYTES, isAllowedInquiryFile } from "../schemas";

/** Lo que acepta el selector: fotos, audios, videos cortos y PDF. */
export const ATTACH_ACCEPT =
  "image/jpeg,image/png,image/webp,audio/*,video/*,application/pdf,.ogg,.opus,.m4a,.mp3,.wav";

const isImage = (f: File) => /^image\/(jpeg|png|webp)$/.test(f.type);

/** Por qué no se puede adjuntar este archivo, o null si se puede. */
export function attachProblem(f: File): string | null {
  if (isImage(f)) return null;
  if (!isAllowedInquiryFile(f.type)) {
    return `"${f.name}": solo fotos, audios, videos o PDF.`;
  }
  if (f.size > MAX_INQUIRY_FILE_BYTES) {
    return `"${f.name}" pesa más de 4 MB.`;
  }
  return null;
}

/**
 * Sube archivos a una consulta que YA existe, de a uno (el tope de tamaño es
 * por pedido). Las fotos se achican antes; el resto va tal cual. Devuelve
 * cuántos fallaron.
 */
export async function uploadToInquiry(
  inquiryId: string,
  files: File[],
): Promise<number> {
  let failed = 0;
  for (const [i, file] of files.entries()) {
    const fd = new FormData();
    fd.set("inquiryId", inquiryId);
    const label = `Subiendo ${i + 1} de ${files.length}…`;
    let ok: boolean;
    if (isImage(file)) {
      fd.set("file", await compressImageToWebp(file, 1600));
      ok = (
        await runAction(() => uploadInquiryImageAction(fd), {
          label,
          silent: true,
        })
      ).ok;
    } else {
      fd.set("file", file);
      // Un audio puede tardar más que una foto en una conexión lenta.
      ok = (
        await runAction(() => uploadInquiryFileAction(fd), {
          label,
          silent: true,
          timeoutMs: 60_000,
        })
      ).ok;
    }
    if (!ok) failed += 1;
  }
  return failed;
}

/** Botón "Adjuntar" de una consulta ya cargada (fotos, audios, PDF). */
export function AttachButton({ inquiryId }: { inquiryId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    const bad = picked.map(attachProblem).find(Boolean);
    if (bad) {
      toast(bad, "danger");
      return;
    }
    setBusy(true);
    try {
      const failed = await uploadToInquiry(inquiryId, picked);
      toast(
        failed > 0
          ? `${failed} archivo${failed === 1 ? " no se subió" : "s no se subieron"}.`
          : "Adjunto guardado en la consulta",
        failed > 0 ? "danger" : "success",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ATTACH_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        Adjuntar foto o audio
      </button>
    </>
  );
}
