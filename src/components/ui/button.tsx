import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClass: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
  icon: "btn-sm",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
}: { variant?: Variant; size?: Size } = {}) {
  return cn("btn", variantClass[variant], sizeClass[size]);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /**
   * Muestra un spinner y deshabilita el botón mientras dura una acción
   * (guardar, borrar, etc.). Da feedback visual de "está trabajando".
   */
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        loading && "relative",
        className,
      )}
      // Mientras carga queda deshabilitado (evita doble submit) pero seguimos
      // marcando aria-busy para lectores de pantalla. El indicador visual de
      // carga es el overlay global de la "H" (runAction) — decisión 2026-07-10:
      // un solo loader en toda la app, nada de spinners por botón.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
