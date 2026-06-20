import Image from "next/image";
import Link from "next/link";
import { getBrandSettings } from "@/features/settings/service";
import { BrandMark } from "./brand-mark";

export async function Footer() {
  const year = new Date().getFullYear();
  const brand = await getBrandSettings();
  return (
    <footer className="footer">
      <div className="store-wrap">
        <div className="foot-grid">
          <div>
            <div className="brand mb-3">
              {brand.logoUrl ? (
                <Image
                  src={brand.logoUrl}
                  alt="Hefesto 3D"
                  width={150}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <>
                  <BrandMark size={40} />
                  <span className="brand-name">
                    HEFESTO<b> 3D</b>
                  </span>
                </>
              )}
            </div>
            <p className="text-faint max-w-[280px] text-sm leading-relaxed">
              Diseños imposibles, impresos en 3D. Hechos a pedido, en el color
              que elijas.
            </p>
          </div>
          <div>
            <h5>Tienda</h5>
            <Link href="/catalogo">Catálogo</Link>
            <Link href="/catalogo?sale=true">Ofertas</Link>
          </div>
          <div>
            <h5>Ayuda</h5>
            <Link href="/catalogo">Cómo funciona</Link>
            <Link href="/ingresar">Mi cuenta</Link>
          </div>
          <div>
            <h5>Hefesto 3D</h5>
            <Link href="/">Inicio</Link>
            <Link href="/catalogo">Productos</Link>
          </div>
        </div>
        <div className="text-faint mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-6 text-xs">
          <span>© {year} Hefesto 3D. Todos los derechos reservados.</span>
          <span>Hecho a pedido en Argentina.</span>
        </div>
      </div>
    </footer>
  );
}
