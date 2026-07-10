import type { MetadataRoute } from "next";

/**
 * Manifest PWA básico (App Router lo enlaza solo en el <head>). Los íconos
 * viven en /public (192/512, generados desde el isotipo BrandMark); el
 * favicon.ico / icon.png / apple-icon.png de src/app los sirve Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hefesto 3D",
    short_name: "Hefesto 3D",
    description:
      "Tienda de productos impresos en 3D, hechos a pedido en el color que elijas.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0F",
    theme_color: "#C9A84C",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
