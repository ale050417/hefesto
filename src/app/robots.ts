import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // /comprobante: documentos privados de cada venta (exigen sesión).
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/comprobante"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
