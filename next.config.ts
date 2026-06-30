import type { NextConfig } from "next";

// Cabeceras de seguridad (Cap. 13/17). No incluimos CSP estricta acá para no
// romper scripts inline de Next ni el checkout de MercadoPago; queda como deuda
// documentada en el relevamiento (definir CSP con nonce).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp"],
  // Subir imágenes (logo/hero/banner/productos) por Server Actions: el límite
  // por defecto es 1 MB. Lo subimos a 8 MB (igual al tope que valida el server).
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    // Formatos modernos: mejor LCP/peso (Core Web Vitals).
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        // Aplica a todas las rutas.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
