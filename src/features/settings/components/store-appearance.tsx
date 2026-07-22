"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/stores/toastStore";
import { cropCoverToWebp } from "@/lib/image-compress";
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
import { StoreLivePreview } from "./store-live-preview";
import { TrustBarEditor } from "./trust-bar-editor";
import { FaqEditor } from "./faq-editor";
import { GalleryEditor } from "./gallery-editor";
import { BannerDurationEditor } from "./banner-duration-editor";
import { runAction } from "@/lib/run-action";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { useDragReframe } from "@/hooks/use-drag-reframe";
import { useFormErrors } from "@/hooks/use-form-errors";

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
// Cuántos segundos corre la decoración al entrar (0 = siempre). Frenarla mejora
// el rendimiento en equipos flojos.
const DURATIONS: Array<[string, number]> = [
  ["Siempre", 0],
  ["5 s", 5],
  ["10 s", 10],
  ["20 s", 20],
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
  posX: number;
  posY: number;
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
  posX: 50,
  posY: 50,
  align: "left",
  ctaText: "",
  ctaHref: "",
  isActive: true,
  sortOrder: 0,
};

// "50% 30%" → { x: 50, y: 30 }. Default centrado.
function parsePos(pos: string | null | undefined): { x: number; y: number } {
  const m = /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/.exec(pos ?? "");
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}

// Por qué NO se editan a mano ciertas secciones (se arman solas con tus datos).
const SECTION_WHY: Record<string, string> = {
  categorias:
    "Las categorías se crean y editan en Catálogo → Categorías. Acá solo elegís si se muestran.",
  nuevos: "Se arma solo con los productos marcados como nuevos.",
  stats:
    "Usa tus datos reales: piezas entregadas y clientes. No se edita a mano.",
  ofertas: "Se arma solo con los productos que tengan precio de oferta.",
  materiales: "Bloque informativo de los materiales con los que imprimís.",
  masVendidos: "Se arma solo según lo que más vendiste.",
  comoFunciona:
    "Los pasos son fijos por ahora; más adelante vas a poder editarlos.",
  pedidoMedida:
    "Un bloque con botón directo a WhatsApp para pedidos personalizados.",
};

/**
 * Tarjeta de una sección del home con su interruptor. Si está apagada, colapsa
 * el cuerpo (no muestra datos) y avisa que está oculta; el interruptor queda
 * visible para volver a prenderla. La vista previa reacciona sola (draft).
 */
function SectionCard({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ui-card section-card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {/* El título despliega/colapsa (solo si la sección está prendida). */}
        <button
          type="button"
          onClick={() => enabled && setOpen((o) => !o)}
          disabled={!enabled}
          aria-expanded={open && enabled}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: enabled ? "pointer" : "default",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{
              flexShrink: 0,
              opacity: enabled ? 0.7 : 0.25,
              transform: open && enabled ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
            }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="section-title" style={{ margin: 0 }}>
            {label}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-faint text-[11.5px]">
            {enabled ? "Visible" : "Oculta"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={label}
            className={`switch ${enabled ? "on" : ""}`}
            onClick={onToggle}
          />
        </div>
      </div>
      {!enabled ? (
        <p className="text-faint text-[12px]">
          Oculta en la tienda. Prendé el interruptor para mostrarla.
        </p>
      ) : open ? (
        children
      ) : null}
    </div>
  );
}

export function StoreAppearance({
  settings,
  banners,
}: {
  settings: BusinessSettings | null;
  banners: StoreBanner[];
}) {
  // Fase 7: el iframe de la vista previa se recarga con cada guardado.
  const [previewVersion, setPreviewVersion] = useState(0);
  const bumpPreview = () => setPreviewVersion((v) => v + 1);
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
    durationSec: settings?.seasonDurationSec ?? 0,
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
  const [confirmBanner, setConfirmBanner] = useState<StoreBanner | null>(null);
  const setB = <K extends keyof BannerForm>(k: K, v: BannerForm[K]): void =>
    setBf((f) => ({ ...f, [k]: v }));
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const fe = useFormErrors();

  async function onBannerFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    // Auto-recorte al tamaño recomendado del hero (1920×720, 16/6): cualquier
    // foto queda prolija y del mismo tamaño, sin redimensionar a mano.
    const compact = await cropCoverToWebp(file, 1920, 720);
    const fd = new FormData();
    fd.set("file", compact);
    const res = await runAction(() => uploadBannerImageAction(fd), {
      silent: true,
    });
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
        // Contacto/redes/descripción se editan en Negocio: acá los reenviamos
        // SIN cambiar (desde settings) para no pisarlos al guardar la apariencia.
        description: settings?.description ?? "",
        whatsapp: settings?.whatsapp ?? "",
        contactEmail: settings?.contactEmail ?? "",
        addressText: settings?.addressText ?? "",
        instagram: settings?.instagram ?? "",
      }),
      saveAppearanceAction({
        accentColor: form.accent,
        season: form.season,
        seasonDeco: form.deco,
        seasonIntensity: form.intensity,
        seasonDurationSec: form.durationSec,
        homeSections: sections,
      }),
    ]);
    setBusy(false);
    if (!a.ok || !b.ok) return toast("No se pudo guardar", "danger");
    toast("Apariencia guardada y publicada", "success");
    bumpPreview();
  }

  function openNewBanner() {
    setBf({ ...EMPTY_BANNER, sortOrder: banners.length });
    setBannerOpen(true);
  }
  function openEditBanner(b: StoreBanner) {
    const p = parsePos(b.position);
    setBf({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl ?? "",
      posX: p.x,
      posY: p.y,
      align: (b.align as BannerForm["align"]) ?? "left",
      ctaText: b.ctaText ?? "",
      ctaHref: b.ctaHref ?? "",
      isActive: b.isActive,
      sortOrder: b.sortOrder,
    });
    setBannerOpen(true);
  }
  async function saveBanner() {
    if (
      !fe.check({ bannerTitle: !bf.title.trim() ? "Ingresá un título." : null })
    )
      return;
    setBusy(true);
    const payload = {
      title: bf.title,
      subtitle: bf.subtitle,
      imageUrl: bf.imageUrl,
      position: `${bf.posX}% ${bf.posY}%`,
      align: bf.align,
      ctaText: bf.ctaText,
      ctaHref: bf.ctaHref,
      isActive: bf.isActive,
      sortOrder: bf.sortOrder,
    };
    const res = bf.id
      ? await runAction(() => updateBannerAction(bf.id!, payload), {
          silent: true,
        })
      : await runAction(() => createBannerAction(payload), { silent: true });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast(bf.id ? "Banner actualizado" : "Banner agregado", "success");
    setBannerOpen(false);
    bumpPreview();
  }
  // Patrón único de eliminación: serializa + toast + preview tras confirmar.
  const { deleteResource: removeBanner } = useDeleteResource({
    action: (bannerId: string) => deleteBannerAction(bannerId),
    successMessage: "Banner eliminado",
    onDeleted: () => bumpPreview(),
  });
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
    bumpPreview();
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

        {/* Contacto y redes se editan solo en Config › Negocio (una sola fuente
            de verdad). La tienda los toma de ahí; acá no se duplican. */}

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
          <div className="field">
            <label>
              Duración al entrar{" "}
              <span className="text-faint font-normal">
                · después frena sola (mejor rendimiento)
              </span>
            </label>
            <div className="flex gap-2">
              {DURATIONS.map(([l, v]) => (
                <button
                  key={v}
                  type="button"
                  className={`chip ${form.durationSec === v ? "active" : ""}`}
                  onClick={() => set("durationSec", v)}
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
                      onClick={() => setConfirmBanner(b)}
                      title="Eliminar"
                    >
                      {sIc(I.trash)}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Duración del carrusel: es parte del hero, va con los banners. */}
          <div
            className="mt-1 flex flex-col gap-2 border-t pt-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="text-[13px] font-semibold">
              Duración del carrusel
            </div>
            <BannerDurationEditor
              bare
              initial={settings?.bannerIntervalSec ?? null}
              onSaved={bumpPreview}
            />
          </div>
        </div>

        {/* Secciones del home, en el orden en que se ven en la tienda. Cada una
            con su interruptor: al apagarla se oculta acá y en la vista previa. */}
        {HOME_SECTIONS.map((s) => {
          const enabled = sections[s.id] !== false;
          const toggle = () =>
            setSections((x) => ({ ...x, [s.id]: x[s.id] === false }));
          let sectionBody: ReactNode;
          if (s.id === "trustBar")
            sectionBody = (
              <TrustBarEditor
                bare
                initial={settings?.trustBar ?? null}
                onSaved={bumpPreview}
              />
            );
          else if (s.id === "faq")
            sectionBody = (
              <FaqEditor
                bare
                initial={settings?.faq ?? null}
                onSaved={bumpPreview}
              />
            );
          else if (s.id === "galeria")
            sectionBody = (
              <GalleryEditor
                initial={settings?.gallery ?? null}
                onSaved={bumpPreview}
              />
            );
          else
            sectionBody = (
              <p className="text-faint text-[12.5px] leading-relaxed">
                {SECTION_WHY[s.id] ?? ""}
              </p>
            );
          return (
            <SectionCard
              key={s.id}
              label={s.label}
              enabled={enabled}
              onToggle={toggle}
            >
              {sectionBody}
            </SectionCard>
          );
        })}

        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={saveAll}
          disabled={busy}
        >
          {sIc(I.check)} Guardar y publicar
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
        <StoreLivePreview
          version={previewVersion}
          draft={{
            name: form.name,
            slogan: form.slogan,
            accent: seasonActive ? SEASONS[form.season].accent : form.accent,
            sections,
          }}
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
            onReframe={(x, y) => setBf((f) => ({ ...f, posX: x, posY: y }))}
          />

          <div className={`field ${fe.errors.bannerTitle ? "invalid" : ""}`}>
            <label>Título</label>
            <input
              className="input"
              aria-invalid={!!fe.errors.bannerTitle}
              value={bf.title}
              onChange={(e) => setB("title", e.target.value)}
              placeholder="Impresión 3D a pedido"
            />
            {fe.errors.bannerTitle ? (
              <p className="field-error">{fe.errors.bannerTitle}</p>
            ) : null}
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
            <div className="text-faint mt-1.5 text-[11.5px]">
              Subí cualquier imagen: se ajusta sola a 1920×720 (16/6). El
              encuadre lo elegís arriba, en la vista previa.
            </div>
            {bf.imageUrl ? (
              <div className="text-faint mt-2 text-[11.5px]">
                Arrastrá la imagen de la vista previa (arriba) para acomodar el
                encuadre: elegís qué parte se ve recortada en pantallas chicas.
              </div>
            ) : null}
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
              {bf.id ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmBanner}
        onClose={() => setConfirmBanner(null)}
        title={
          confirmBanner
            ? `¿Eliminar el banner "${confirmBanner.title || "(sin título)"}"?`
            : "¿Eliminar banner?"
        }
        onConfirm={() => {
          if (confirmBanner) return removeBanner(confirmBanner.id);
        }}
      />
    </div>
  );
}

/** Vista previa POR DISPOSITIVO del banner del hero (admin): Compu 16/6, Tablet
 *  16/9 y Celular 4/3. La foto va con object-cover (llena sin deformar) y el
 *  ENCUADRE (posX/posY) elige el foco; se arrastra sobre el recuadro "Compu" y
 *  los tres se actualizan en vivo, así ves cómo recorta cada pantalla. */
function BannerLivePreview({
  banner,
  accent,
  onReframe,
}: {
  banner: BannerForm;
  accent: string;
  onReframe?: (x: number, y: number) => void;
}) {
  const hasImg = Boolean(banner.imageUrl);
  const reframe = useDragReframe(
    banner.posX,
    banner.posY,
    onReframe ?? (() => {}),
  );
  const canDrag = hasImg && !!onReframe;
  const pos = `${banner.posX}% ${banner.posY}%`;
  const title = banner.title.trim() || "Título del banner";
  const words = title.split(" ");
  const last = words.length > 1 ? words.pop() : null;

  const frame = (
    label: string,
    ratio: string,
    draggable: boolean,
    withText: boolean,
  ) => {
    const drag = draggable && canDrag;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-faint text-[11px]">{label}</span>
        <div
          {...(drag ? reframe.handlers : {})}
          style={{
            position: "relative",
            containerType: "inline-size",
            aspectRatio: ratio,
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: hasImg
              ? `${pos}/cover no-repeat url('${banner.imageUrl}')`
              : `linear-gradient(135deg, ${accent}33, var(--surface-2))`,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems:
              banner.align === "center"
                ? "center"
                : banner.align === "right"
                  ? "flex-end"
                  : "flex-start",
            padding: 0,
            touchAction: drag ? "none" : undefined,
            cursor: drag ? (reframe.dragging ? "grabbing" : "grab") : "default",
          }}
        >
          {hasImg ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(8,6,3,.75) 0%, rgba(8,6,3,.3) 45%, rgba(8,6,3,0) 72%)",
              }}
            />
          ) : null}
          {withText ? (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                maxWidth: "82%",
                padding: "clamp(8px, 5cqw, 20px)",
                textAlign: banner.align,
                textShadow: "0 2px 12px rgba(0,0,0,.5)",
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: "clamp(11px, 4.4cqw, 30px)",
                  fontWeight: 900,
                  lineHeight: 1.1,
                }}
              >
                {last ? (
                  <>
                    {words.join(" ")}{" "}
                    <span style={{ color: accent }}>{last}</span>
                  </>
                ) : (
                  title
                )}
              </div>
              {banner.subtitle.trim() ? (
                <div
                  style={{
                    fontSize: "clamp(8px, 2.6cqw, 15px)",
                    opacity: 0.9,
                    marginTop: "0.15em",
                  }}
                >
                  {banner.subtitle}
                </div>
              ) : null}
              <span
                className="font-semibold"
                style={{
                  marginTop: "clamp(4px, 2cqw, 8px)",
                  display: "inline-flex",
                  background: accent,
                  color: "#1a1505",
                  borderRadius: 999,
                  padding: "clamp(3px, 1.4cqw, 6px) clamp(7px, 3.2cqw, 14px)",
                  fontSize: "clamp(8px, 2.5cqw, 13px)",
                }}
              >
                {banner.ctaText.trim() || "Ver catálogo"}
              </span>
            </div>
          ) : null}
          {!banner.isActive ? (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                zIndex: 2,
                background: "rgba(0,0,0,.6)",
                color: "#fff",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 10,
              }}
            >
              Oculto
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="field">
      <label>Vista previa por dispositivo</label>
      <div className="flex flex-col gap-3">
        {frame("Compu (16/6)", "16 / 6", true, true)}
        <div className="grid grid-cols-2 gap-3">
          {frame("Tablet (16/9)", "16 / 9", false, true)}
          {frame("Celular (4/3)", "4 / 3", false, true)}
        </div>
      </div>
      {canDrag ? (
        <div className="text-faint mt-1 text-[11.5px]">
          Arrastrá la imagen del recuadro <b>Compu</b> para elegir el foco; los
          tres se actualizan solos. Así ves cómo se recorta en cada pantalla.
        </div>
      ) : hasImg ? null : (
        <div className="text-faint mt-1 text-[11.5px]">
          Subí una imagen para ver la vista previa.
        </div>
      )}
    </div>
  );
}

function bannerPayload(b: StoreBanner, sortOrder: number) {
  return {
    title: b.title,
    subtitle: b.subtitle ?? "",
    imageUrl: b.imageUrl ?? "",
    position: b.position,
    align: b.align,
    ctaText: b.ctaText ?? "",
    ctaHref: b.ctaHref ?? "",
    isActive: b.isActive,
    sortOrder,
  };
}
