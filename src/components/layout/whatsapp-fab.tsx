import { getBrandSettings } from "@/features/settings/service";
import { whatsappUrl } from "@/lib/site";

// Botón flotante de contacto por WhatsApp. Usa el número configurado en el
// admin; si no hay, cae al de la variable de entorno.
export async function WhatsappFab() {
  const brand = await getBrandSettings();
  const phone = (brand.whatsapp ?? "").replace(/\D/g, "");
  const href = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent("¡Hola Hefesto 3D! Quería hacer una consulta.")}`
    : whatsappUrl("¡Hola Hefesto 3D! Quería hacer una consulta.");

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Escribinos por WhatsApp"
      className="fixed right-5 bottom-5 z-[250] grid h-12 w-12 place-items-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
      style={{ background: "#25D366" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        width="26"
        height="26"
        aria-hidden
      >
        <path d="M.06 24l1.68-6.13A11.86 11.86 0 0 1 .16 11.9C.16 5.34 5.5 0 12.06 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.42c0 6.55-5.34 11.89-11.9 11.89a11.9 11.9 0 0 1-5.68-1.45L.06 24zM6.6 20.13c1.68.99 3.28 1.59 5.45 1.59 5.45 0 9.89-4.43 9.89-9.88a9.8 9.8 0 0 0-2.89-6.99 9.82 9.82 0 0 0-6.99-2.9c-5.46 0-9.89 4.43-9.89 9.88 0 2.28.6 3.99 1.69 5.7l-1 3.63 3.74-1.13zm10.96-5.55c-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42z" />
      </svg>
    </a>
  );
}
