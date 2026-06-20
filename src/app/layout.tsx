import type { Metadata } from "next";
import { Orbitron, Sora } from "next/font/google";
import { siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

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
      className={`${orbitron.variable} ${sora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
