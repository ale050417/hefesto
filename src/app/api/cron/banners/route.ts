import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { env } from "@/core/config/env";
import { refreshAutoBanners } from "@/features/settings/auto-banners";

/**
 * Cron de Vercel (vercel.json): renueva los banners del hero con IA cada 10
 * días. Vercel llama con `Authorization: Bearer <CRON_SECRET>`; sin ese
 * secreto configurado la ruta no hace nada (el botón del panel sigue
 * funcionando). `?force=1` saltea el chequeo de los 10 días.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const result = await refreshAutoBanners({ force });
    if (result.ok) {
      revalidatePath("/", "layout");
      revalidatePath("/admin/configuracion");
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron:banners] falló:", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
