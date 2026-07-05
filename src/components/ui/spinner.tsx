import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Spinner inline (para botones y estados de carga chicos). Gira con
 * `animate-spin`; hereda el color del texto (`currentColor`). Para el loader
 * de pantalla completa con marca, usar HefestoLoader.
 */
export function Spinner({
  size = 16,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Cargando"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
