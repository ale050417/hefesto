import { BrandImageUpload } from "@/features/settings/components/brand-image-upload";
import { getBrandSettings } from "@/features/settings/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Apariencia" };

export default async function AppearancePage() {
  const brand = await getBrandSettings();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-fg mb-1 text-2xl">Apariencia</h1>
      <p className="text-dim mb-6 text-sm">
        Elegí el logo y la imagen del hero de la tienda. (Versión simple; se
        amplía más adelante.)
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <BrandImageUpload
          kind="logo"
          label="Logo"
          hint="Se muestra en el encabezado y el pie. PNG con fondo transparente recomendado."
          currentUrl={brand.logoUrl}
        />
        <BrandImageUpload
          kind="hero"
          label="Imagen del hero"
          hint="El panel grande de la portada. Horizontal, buena resolución."
          currentUrl={brand.heroImageUrl}
        />
      </div>
    </div>
  );
}
