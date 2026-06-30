import { HefestoLoader } from "@/components/shared/hefesto-loader";

export default function AdminLoading() {
  return (
    <div className="view flex min-h-[60vh] items-center justify-center">
      <HefestoLoader label="Cargando panel…" />
    </div>
  );
}
