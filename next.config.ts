import type { NextConfig } from "next";

// Cabeceras de seguridad (Cap. 13/17). No incluimos CSP estricta acá para no
// romper scripts inline de Next ni el checkout de MercadoPago; queda como deuda
// documentada en el relevamiento (definir CSP con nonce).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // SAMEORIGIN (no DENY): la vista previa del admin embebe la PROPIA tienda en
  // un iframe (Fase 7). Sitios de terceros siguen sin poder framearnos
  // (anti-clickjacking); el refuerzo moderno es frame-ancestors 'self' (abajo).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
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
  // react-pdf (comprobante en PDF) se carga desde node_modules, sin empaquetar:
  // es la forma soportada en el App Router.
  // @cwasm/webp (logo del PDF sin sharp) lee su .wasm con fs desde su
  // carpeta: externo, y su carpeta incluida en el trazado (abajo).
  serverExternalPackages: ["sharp", "@react-pdf/renderer", "@cwasm/webp"],
  // Las fuentes del PDF (public/fonts) se leen con fs en el servidor: hay que
  // incluirlas en el trazado de la función, si no en Vercel no existen.
  outputFileTracingIncludes: {
    "/comprobante/**": [
      "./public/fonts/*.ttf",
      "./node_modules/@cwasm/webp/**",
      "./node_modules/.pnpm/@cwasm+webp*/node_modules/@cwasm/webp/**",
    ],
  },
  // Subir imágenes (logo/hero/banner/productos) por Server Actions: el límite
  // por defecto es 1 MB. Lo subimos a 8 MB (igual al tope que valida el server).
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    // Las fotos se sirven DIRECTO desde Supabase, sin el optimizador de Vercel
    // (2026-08-09). Motivo concreto: en producción las imágenes empezaron a
    // devolver HTTP 402 (Payment Required) — se había agotado la cuota mensual
    // de optimización del plan, y las fotos que necesitaban una transformación
    // nueva quedaban en blanco. Se veían solo las ya cacheadas de antes, así
    // que parecía "algunas fotos sí y otras no".
    //
    // Es redundante pagar por optimizar dos veces: cada foto YA se sube
    // convertida a WebP y redimensionada a 1600 px (`compressImageToWebp` en
    // el navegador + `optimizeImage` con sharp en el servidor). El optimizador
    // volvía a procesar lo ya procesado.
    //
    // Se sacó también `formats: ["image/avif", "image/webp"]`: pedía DOS
    // transformaciones por foto y por tamaño, o sea el doble de consumo, para
    // una ganancia mínima sobre un WebP que ya está comprimido.
    //
    // Contra asumida: el navegador descarga la foto completa en vez de una
    // versión recortada por dispositivo. Con WebP de 1600 px el peso es
    // aceptable; si algún día molesta en celular, el camino correcto es
    // generar varios tamaños AL SUBIR (una vez), no transformar en cada visita.
    unoptimized: true,
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
