import { headers } from "next/headers";

/** IP del cliente a partir de los headers de proxy (best-effort). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return h.get("x-real-ip") ?? "unknown";
}
