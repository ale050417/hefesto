"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { uploadBrandImageAction } from "../actions";

export function BrandImageUpload({
  kind,
  label,
  hint,
  currentUrl,
}: {
  kind: "logo" | "hero";
  label: string;
  hint: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadBrandImageAction(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setUrl(res.data.url);
    router.refresh();
  }

  return (
    <div className="ui-card p-5">
      <h3 className="text-fg font-display mb-1 text-base">{label}</h3>
      <p className="text-dim mb-4 text-sm">{hint}</p>

      <div className="bg-surface-2 border-surface-3 relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-lg border">
        {url ? (
          <Image
            src={url}
            alt={label}
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            className="object-contain"
          />
        ) : (
          <span className="text-faint text-sm">Sin imagen</span>
        )}
      </div>

      {error ? (
        <p className="bg-danger/10 text-danger mb-3 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        disabled={busy}
        className="hidden"
        id={`upload-${kind}`}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Subiendo…" : url ? "Cambiar imagen" : "Subir imagen"}
      </Button>
    </div>
  );
}
