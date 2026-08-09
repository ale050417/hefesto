/** Ícono de WhatsApp para botones de contacto ("Consultar ya", CTAs de coordinar
 *  pago). Mismo trazo que ya usaban `checkout/exito` y `admin/medida`, ahora
 *  compartido para no repetir el `<path>` en cada botón nuevo. */
export function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.09c-.25.69-1.43 1.32-1.97 1.37-.5.05-.97.23-3.27-.68-2.76-1.09-4.5-3.9-4.64-4.09-.13-.19-1.1-1.47-1.1-2.8s.7-1.98.94-2.25c.25-.27.54-.34.72-.34l.52.01c.17 0 .39-.06.61.47.22.53.76 1.86.83 2 .07.13.11.29.02.47-.09.19-.13.3-.27.46l-.4.47c-.13.13-.27.28-.12.54.15.27.66 1.09 1.42 1.77.98.87 1.8 1.14 2.06 1.27.26.13.41.11.56-.07.15-.18.64-.75.81-1.01.17-.26.34-.21.57-.13.23.09 1.47.69 1.72.82.25.13.42.19.48.3.06.1.06.6-.19 1.29Z" />
    </svg>
  );
}
