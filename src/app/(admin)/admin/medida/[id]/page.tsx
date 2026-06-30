import { redirect } from "next/navigation";

// El panel de "a medida" es ahora un chat de 2 paneles (lista + conversación)
// en /admin/medida. Mantenemos esta ruta para no romper links viejos
// (notificaciones, etc.) y redirigimos a la conversación seleccionada.
export default async function AdminCustomDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/medida?req=${id}`);
}
