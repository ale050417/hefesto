export default function AdminLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-20"
      role="status"
      aria-live="polite"
    >
      <span
        className="border-surface-3 border-t-accent h-10 w-10 animate-spin rounded-full border-4"
        aria-hidden="true"
      />
      <p className="text-dim text-sm">Cargando panel…</p>
    </div>
  );
}
