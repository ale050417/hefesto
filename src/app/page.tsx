// Placeholder temporal del Paso 2 (Fase 0): valida tokens, temas y fuentes.
// La Home real se construye en la Fase 1 (Cap. 18, paso 16).
export default function Home() {
  return (
    <main className="bg-bg text-fg flex min-h-dvh items-center justify-center p-6">
      <div className="bg-surface-1 w-full max-w-md rounded-lg p-8 shadow-md">
        <p className="eyebrow">Fase 0 · Paso 2</p>
        <h1 className="font-display text-primary mt-3 text-3xl">Hefesto 3D</h1>
        <p className="text-dim mt-3">
          Design tokens, temas y tipografía conectados a Tailwind.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="bg-primary text-primary-fg rounded-sm px-3 py-1 text-sm">
            primary
          </span>
          <span className="bg-success text-bg rounded-sm px-3 py-1 text-sm">
            success
          </span>
          <span className="bg-warning text-bg rounded-sm px-3 py-1 text-sm">
            warning
          </span>
          <span className="bg-danger text-bg rounded-sm px-3 py-1 text-sm">
            danger
          </span>
          <span className="bg-info text-bg rounded-sm px-3 py-1 text-sm">
            info
          </span>
        </div>

        <div className="mt-6 flex gap-3">
          <div className="bg-surface-2 h-10 flex-1 rounded-md" />
          <div className="bg-surface-3 h-10 flex-1 rounded-md" />
        </div>

        <p className="text-faint mt-6 text-sm">
          Cambiá <code>data-theme</code> a <code>light</code> o{" "}
          <code>warm</code> en &lt;html&gt; para ver los temas.
        </p>
      </div>
    </main>
  );
}
