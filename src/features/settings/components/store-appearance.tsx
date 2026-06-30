"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";
import { compressImageToWebp } from "@/lib/image-compress";
import {
  createBannerAction,
  deleteBannerAction,
  saveAppearanceAction,
  saveBusinessInfoAction,
  updateBannerAction,
  uploadBannerImageAction,
} from "../actions";
import { SEASONS, type SeasonKey } from "../seasons";
import { HOME_SECTIONS, sectionOn } from "../home-sections";
import type { BusinessSettings, StoreBanner } from "../types";
import { BrandImageUpload } from "./brand-image-upload";
import { StorePreview } from "./store-preview";

const ACCENTS = [
  "#C9A84C",
  "#D4AF37",
  "#5A9CD9",
  "#9B7BD4",
  "#4CB782",
  "#D96A5A",
  "#E0A82E",
  "#2E8B57",
  "#7B4DB3",
];
const INTENSITIES: Array<[string, number]> = [
  ["Sutil", 9],
  ["Media", 16],
  ["Festiva", 26],
];

const sIc = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:
    '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
};

const ALIGN_LABEL: Record<string, string> = {
  left: "izquierda",
  center: "centro",
  right: "derecha",
};

type BannerForm = {
  id?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  align: "left" | "center" | "right";
  ctaText: string;
  ctaHref: string;
  isActive: boolean;
  sortOrder: number;
};
const EMPTY_BANNER: BannerForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  align: "left",
  ctaText: "",
  ctaHref: "",
  isActive: true,
  sortOrder: 0,
};

export function StoreAppearance({
  settings,
  banners,
}: {
  settings: BusinessSettings | null;
  banners: StoreBanner[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    accent: settings?.accentColor ?? "#C9A84C",
    name: settings?.storeName ?? "",
    slogan: settings?.slogan ?? "",
    whatsapp: settings?.whatsapp ?? "",
    instagram: settings?.instagram ?? "",
    email: settings?.contactEmail ?? "",
    address: settings?.addressText ?? "",
    desc: settings?.description ?? "",
    season: (settings?.season as SeasonKey) ?? "none",
    deco: settings?.seasonDeco ?? false,
    intensity: settings?.seasonIntensity ?? 16,
  });
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of HOME_SECTIONS)
      init[s.id] = sectionOn(settings?.homeSections, s.id);
    return init;
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void =>
    setForm((f) => ({ ...f, [k]: v }));
  const seasonActive = form.season !== "none";

  const [bannerOpen, setBannerOpen] = useState(false);
  const [bf, setBf] = useState<BannerForm>(EMPTY_BANNER);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const setB = <K extends keyof BannerForm>(k: K, v: BannerForm[K]): void =>
    setBf((f) => ({ ...f, [k]: v }));
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);

  async function onBannerFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    const compact = await compressImageToWebp(file, 1600);
    const fd = new FormData();
    fd.set("file", compact);
    const res = await uploadBannerImageAction(fd);
    setImgBusy(false);
    if (bannerFileRef.current) bannerFileRef.current.value = "";
    if (!res.ok) return toast(res.error.message, "danger");
    setB("imageUrl", res.data.url);
  }

  async function saveAll() {
    setBusy(true);
    const [a, b] = await Promise.all([
      saveBusinessInfoAction({
        storeName: form.name,
        slogan: form.slogan,
        description: form.desc,
        whatsapp: form.whatsapp,
        contactEmail: form.email,
        addressText: form.address,
        instagram: form.instagram,
      }),
      saveAppearanceAction({
        accentColor: form.accent,
        season: form.season,
        seasonDeco: form.deco,
        seasonIntensity: form.intensity,
        homeSections: sections,
      }),
    ]);
    setBusy(false);
    if (!a.ok || !b.ok) return toast("No se pudo guardar", "danger");
    toast("Apariencia guardada y publicada", "success");
    router.refresh();
  }

  function openNewBanner() {
    setBf({ ...EMPTY_BANNER, sortOrder: banners.length });
    setBannerOpen(true);
  }
  function openEditBanner(b: StoreBanner) {
    setBf({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl ?? "",
      align: (b.align as BannerForm["align"]) ?? "left",
      ctaText: b.ctaText ?? "",
      ctaHref: b.ctaHref ?? "",
      isActive: b.isActive,
      sortOrder: b.sortOrder,
    });
    setBannerOpen(true);
  }
  async function saveBanner() {
    if (!bf.title.trim()) return toast("Ingresá un título", "danger");
    setBusy(true);
    const payload = {
      title: bf.title,
      subtitle: bf.subtitle,
      imageUrl: bf.imageUrl,
      align: bf.align,
      ctaText: bf.ctaText,
      ctaHref: bf.ctaHref,
      isActive: bf.isActive,
      sortOrder: bf.sortOrder,
    };
    const res = bf.id
      ? await updateBannerAction(bf.id, payload)
      : await createBannerAction(payload);
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast(bf.id ? "Banner actualizado" : "Banner agregado", "success");
    setBannerOpen(false);
    router.refresh();
  }
  async function removeBanner(b: StoreBanner) {
    if (!window.confirm(`¿Eliminar el banner "${b.title}"?`)) return;
    setPendingId(b.id);
    const res = await deleteBannerAction(b.id);
    setPendingId(null);
    if (res.ok) {
      toast("Banner eliminado", "danger");
      router.refresh();
    } else toast(res.error.message, "danger");
  }
  async function moveUp(i: number) {
    if (i <= 0) return;
    const cur = banners[i]!;
    const prev = banners[i - 1]!;
    setPendingId(cur.id);
    await Promise.all([
      updateBannerAction(cur.id, bannerPayload(cur, prev.sortOrder)),
      updateBannerAction(prev.id, bannerPayload(prev, cur.sortOrder)),
    ]);
    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="store-cfg-grid" style={{ gap: 24 }}>
      {/* COLUMNA IZQUIERDA */}
      <div className="flex flex-col gap-4">
        {/* Logo (la portada/hero se maneja desde "Banners del hero" más abajo) */}
        <BrandImageUpload
          kind="logo"
          label="Logo"
          hint="Header y pie. PNG con fondo transparente."
          currentUrl={settings?.logoUrl ?? null}
        />

        {/* Identidad */}
        <div className="ui-card section-card flex flex-col gap-4">
          <div className="section-title">Identidad de la tienda</div>
          <div className="field">
            <label>
              Color de acento{" "}
              {seasonActive ? (
                <span className="text-faint font-normal">
                  · definido por la temporada activa
                </span>
              ) : null}
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => set("accent", c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: c,
                    cursor: "pointer",
                    border: `2px solid ${form.accent === c ? "var(--fg)" : "transparent"}`,
                    boxShadow: "0 0 0 1px var(--border)",
                    opacity: seasonActive ? 0.5 : 1,
                  }}
                />
              ))}
              <label className="accent-custom" title="Color personalizado">
                {sIc(I.plus)}
                <input
                  type="color"
                  value={form.accent}
                  onChange={(e) => set("accent", e.target.value)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
              </label>
            </div>
          </div>
          <div className="field">
            <label>
              Nombre comercial{" "}
              <span className="text-faint font-normal">· tu marca</span>
            </label>
            <input
              className="input"
              value={form.name}
              placeholder="HEFESTO 3D"
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Eslogan (bajo el logo)</label>
            <input
              className="input"
              value={form.slogan}
              placeholder="Forjado en capas"
              onChange={(e) => set("slogan", e.target.value)}
            />
          </div>
        </div>

        {/* Contacto */}
        <div className="ui-card section-card flex flex-col gap-3">
          <div className="section-title">Contacto y redes</div>
          <div className="text-faint -mt-2 text-[12.5px]">
            Se muestran en el pie de la tienda y en los accesos de contacto.
          </div>
          <div className="grid-2">
            <div className="field">
              <label>WhatsApp</label>
              <input
                className="input"
                value={form.whatsapp}
                placeholder="+54 11 ..."
                onChange={(e) => set("whatsapp", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Instagram</label>
              <input
                className="input"
                value={form.instagram}
                placeholder="@tutienda"
                onChange={(e) => set("instagram", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Email de contacto</label>
            <input
              className="input"
              value={form.email}
              placeholder="hola@tutienda.com"
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Dirección / taller</label>
            <input
              className="input"
              value={form.address}
              placeholder="Calle 123, Ciudad"
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Descripción del pie</label>
            <textarea
              className="textarea"
              style={{ minHeight: 64 }}
              value={form.desc}
              placeholder="Breve descripción de tu tienda..."
              onChange={(e) => set("desc", e.target.value)}
            />
          </div>
        </div>

        {/* Temporadas */}
        <div className="ui-card section-card flex flex-col gap-3">
          <div>
            <div className="section-title">Temporadas y campañas</div>
            <div className="text-faint mt-0.5 text-[12.5px]">
              Vestí tu tienda para cada fecha festiva. Cambia el acento y la
              decoración animada al instante.
            </div>
          </div>
          <div className="grid-4" style={{ gap: 10 }}>
            {(Object.keys(SEASONS) as SeasonKey[]).map((k) => {
              const s = SEASONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  className={`season-card ${form.season === k ? "on" : ""}`}
                  onClick={() => set("season", k)}
                >
                  <div className="se-check">{sIc(I.check)}</div>
                  <div
                    className="se-ico"
                    style={{
                      color: form.season === k ? s.accent : "var(--text-dim)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={24}
                      height={24}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: s.icon }}
                    />
                  </div>
                  <div className="se-name">{s.label}</div>
                  <div className="se-dots">
                    <span style={{ background: s.accent }} />
                    <span style={{ background: s.accent2 }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div
            className="ui-card flex items-center justify-between"
            style={{ padding: "13px 15px" }}
          >
            <div>
              <div className="text-[13.5px] font-semibold">
                Decoración animada
              </div>
              <div className="text-faint text-[12px]">
                Copos, hojas, corazones cayendo según la temporada.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.deco}
              aria-label="Decoración"
              className={`switch ${form.deco ? "on" : ""}`}
              onClick={() => set("deco", !form.deco)}
            />
          </div>
          <div className="field">
            <label>Intensidad del efecto</label>
            <div className="flex gap-2">
              {INTENSITIES.map(([l, v]) => (
                <button
                  key={v}
                  type="button"
                  className={`chip ${form.intensity === v ? "active" : ""}`}
                  onClick={() => set("intensity", v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Banners */}
        <div className="ui-card section-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="section-title">Banners del hero</div>
              <div className="text-faint mt-0.5 text-[12.5px]">
                Slides rotativos arriba de la tienda.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openNewBanner}
            >
              {sIc(I.plus)} Agregar
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {banners.length === 0 ? (
              <div className="text-faint p-2 text-[13px]">
                Sin banners. Agregá el primero.
              </div>
            ) : (
              banners.map((b, i) => (
                <div
                  key={b.id}
                  className="ui-card flex items-center justify-between"
                  style={{ padding: "11px 13px" }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="banner-thumb"
                      style={
                        b.imageUrl
                          ? { background: `center/cover url('${b.imageUrl}')` }
                          : undefined
                      }
                    >
                      {b.imageUrl ? null : sIc(I.box)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">
                        {b.title || "(sin título)"}
                      </div>
                      <div className="text-faint text-[11.5px]">
                        {b.imageUrl ? "Con imagen" : "Sin imagen"} · texto{" "}
                        {ALIGN_LABEL[b.align] ?? "izquierda"}
                        {b.isActive ? "" : " · oculto"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-icon btn-ghost"
                      disabled={i === 0 || pendingId === b.id}
                      onClick={() => moveUp(i)}
                      title="Subir"
                      style={i === 0 ? { opacity: 0.3 } : undefined}
                    >
                      {sIc(I.up)}
                    </button>
                    <button
                      className="btn-icon btn-ghost"
                      onClick={() => openEditBanner(b)}
                      title="Editar"
                    >
                      {sIc(I.edit)}
                    </button>
                    <button
                      className="btn-icon btn-ghost"
                      disabled={pendingId === b.id}
                      onClick={() => removeBanner(b)}
                      title="Eliminar"
                    >
                      {sIc(I.trash)}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Secciones del home */}
        <div className="ui-card section-card flex flex-col gap-2">
          <div>
            <div className="section-title">Secciones del home</div>
            <div className="text-faint mt-0.5 text-[12.5px]">
              Activá o desactivá lo que ve tu cliente en la portada.
            </div>
          </div>
          {HOME_SECTIONS.map((s) => (
            <div
              key={s.id}
              className="ui-card flex items-center justify-between"
              style={{ padding: "11px 14px" }}
            >
              <div className="text-[13.5px] font-semibold">{s.label}</div>
              <button
                type="button"
                role="switch"
                aria-checked={sections[s.id] !== false}
                aria-label={s.label}
                className={`switch ${sections[s.id] !== false ? "on" : ""}`}
                onClick={() =>
                  setSections((x) => ({ ...x, [s.id]: x[s.id] === false }))
                }
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={saveAll}
          disabled={busy}
        >
          {sIc(I.check)} {busy ? "Guardando…" : "Guardar y publicar"}
        </button>
      </div>

      {/* COLUMNA DERECHA: vista previa */}
      <div
        className="flex flex-col gap-3"
        style={{ position: "sticky", top: 84 }}
      >
        <div className="flex items-center justify-between">
          <div className="section-title text-[15px]">
            Vista previa · pantalla del cliente
          </div>
          <span className="badge badge-success">En vivo</span>
        </div>
        <StorePreview
          accent={seasonActive ? SEASONS[form.season].accent : form.accent}
          name={form.name || "HEFESTO 3D"}
          slogan={form.slogan || "Forjado en capas"}
          banner={banners.find((b) => b.isActive) ?? null}
          sections={sections}
        />
        <a
          className="btn btn-secondary btn-block"
          href="/"
          target="_blank"
          rel="noreferrer"
        >
          {sIc(I.eye)} Abrir tienda completa
        </a>
      </div>

      <Modal
        open={bannerOpen}
        onClose={() => setBannerOpen(false)}
        title={bf.id ? "Editar banner" : "Nuevo banner"}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {/* Vista previa en vivo de cómo se ve el banner en el hero */}
          <BannerLivePreview
            banner={bf}
            accent={seasonActive ? SEASONS[form.season].accent : form.accent}
          />

          <div className="field">
            <label>Título</label>
            <input
              className="input"
              value={bf.title}
              onChange={(e) => setB("title", e.target.value)}
              placeholder="Impresión 3D a pedido"
            />
          </div>
          <div className="field">
            <label>Subtítulo</label>
            <input
              className="input"
              value={bf.subtitle}
              onChange={(e) => setB("subtitle", e.target.value)}
              placeholder="En el color que elijas"
            />
          </div>
          <div className="field">
            <label>
              Imagen de fondo{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </label>
            <button
              type="button"
              className="banner-drop"
              onClick={() => bannerFileRef.current?.click()}
              style={
                bf.imageUrl
                  ? {
                      background: `center/cover url('${bf.imageUrl}')`,
                    }
                  : undefined
              }
            >
              {bf.imageUrl ? null : (
                <span className="text-faint text-[12.5px]">
                  {imgBusy ? "Subiendo…" : "Hacé clic para subir una imagen"}
                </span>
              )}
            </button>
            <input
              ref={bannerFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onBannerFile}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={imgBusy}
                onClick={() => bannerFileRef.current?.click()}
              >
                {sIc(I.box)} {imgBusy ? "Subiendo…" : "Subir imagen"}
              </button>
              {bf.imageUrl ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setB("imageUrl", "")}
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <div className="text-faint mt-2 text-[11.5px] leading-relaxed">
              Tamaño recomendado: <b>1600 × 600 px</b> (apaisado, relación 8:3).
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Texto del botón</label>
              <input
                className="input"
                value={bf.ctaText}
                onChange={(e) => setB("ctaText", e.target.value)}
                placeholder="Ver catálogo"
              />
            </div>
            <div className="field">
              <label>Link del botón</label>
              <input
                className="input"
                value={bf.ctaHref}
                onChange={(e) => setB("ctaHref", e.target.value)}
                placeholder="/catalogo"
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Posición del texto</label>
              <div className="flex gap-2">
                {(
                  [
                    ["left", "Izquierda"],
                    ["center", "Centro"],
                    ["right", "Derecha"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${bf.align === v ? "active" : ""}`}
                    onClick={() => setB("align", v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-dim flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--gold)]"
                checked={bf.isActive}
                onChange={(e) => setB("isActive", e.target.checked)}
              />
              Visible en la tienda
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBannerOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={saveBanner} disabled={busy}>
              {busy ? "Guardando…" : bf.id ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Vista previa en vivo del banner del hero mientras se carga (admin). */
function BannerLivePreview({
  banner,
  accent,
}: {
  banner: BannerForm;
  accent: string;
}) {
  const align = banner.align ?? "left";
  const hasImg = Boolean(banner.imageUrl);
  const title = banner.title.trim() || "Título del banner";
  const words = title.split(" ");
  const last = words.length > 1 ? words.pop() : null;

  const justify =
    align === "center"
      ? "center"
      : align === "right"
        ? "flex-end"
        : "flex-start";

  return (
    <div className="field">
      <label>Vista previa</label>
      <div
        style={{
          position: "relative",
          aspectRatio: "8 / 3",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: hasImg
            ? `linear-gradient(rgba(10,8,4,.55), rgba(10,8,4,.55)), center/cover url('${banner.imageUrl}')`
            : `linear-gradient(135deg, ${accent}33, var(--surface-2))`,
          color: hasImg ? "#fff" : "var(--fg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: justify,
          textAlign: align,
          padding: "20px 22px",
          gap: 8,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1.1,
            maxWidth: "85%",
          }}
        >
          {last ? (
            <>
              {words.join(" ")} <span style={{ color: accent }}>{last}</span>
            </>
          ) : (
            title
          )}
        </div>
        {banner.subtitle.trim() ? (
          <div
            style={{
              fontSize: 12,
              opacity: hasImg ? 0.9 : 0.7,
              maxWidth: "80%",
            }}
          >
            {banner.subtitle}
          </div>
        ) : null}
        <span
          className="font-semibold"
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: accent,
            color: "#1a1505",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 12,
            width: "fit-content",
          }}
        >
          {banner.ctaText.trim() || "Ver catálogo"}
        </span>
        {!banner.isActive ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,.6)",
              color: "#fff",
              borderRadius: 999,
              padding: "3px 9px",
              fontSize: 10,
            }}
          >
            Oculto
          </span>
        ) : null}
      </div>
    </div>
  );
}

function bannerPayload(b: StoreBanner, sortOrder: number) {
  return {
    title: b.title,
    subtitle: b.subtitle ?? "",
    imageUrl: b.imageUrl ?? "",
    align: b.align,
    ctaText: b.ctaText ?? "",
    ctaHref: b.ctaHref ?? "",
    isActive: b.isActive,
    sortOrder,
  };
}
