import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const variantClass: Record<Variant, string> = {
  primary: "badge-gold",
  gold: "badge-gold",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn("badge", variantClass[variant], className)}
      {...props}
    />
  );
}
