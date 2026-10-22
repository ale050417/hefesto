import type { Metadata } from "next";
import { siteName, siteUrl } from "@/lib/site";
import { Toaster } from "@/components/ui/toaster";
import { ActionOverlay } from "@/components/shared/action-overlay";
import { ThemeApplier } from "@/features/settings/components/theme-applier";
// Fuentes AUTOALOJADAS (2026-10-21): con next/font/google el build de Vercel
// fallaba al azar ("Can't resolve '@vercel/turbopack-next/internal/font/
// google/font'") cuando no podía bajar las fuentes de Google. Fontsource
// las trae por npm: el build no depende de la red.
import "@fontsource-variable/sora";
import "@fontsource-variable/orbitron";
import "./globals.css";

const description =
  "Tienda de productos impresos en 3D, hechos a pedido en el color que elijas.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hefesto 3D — Impresión 3D a pedido",
    template: "%s · Hefesto 3D",
  },
  description,
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName,
    title: "Hefesto 3D — Impresión 3D a pedido",
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="light"
      // El script inline ajusta data-theme desde localStorage antes de hidratar;
      // suprimimos el warning de mismatch SOLO en <html> (patrón estándar de tema).
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('hefesto-theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
        <ThemeApplier />
        {children}
        <Toaster />
        <ActionOverlay />
      </body>
    </html>
  );
}
