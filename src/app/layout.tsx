import type { Metadata } from "next";
import { Orbitron, Sora } from "next/font/google";
import "./globals.css";

// Display (Cap. 7.4)
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

// Body (Cap. 7.4)
const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hefesto 3D",
  description: "Tienda de productos impresos en 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="dark"
      className={`${orbitron.variable} ${sora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
