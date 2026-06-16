import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg",
        success: "bg-success text-bg",
        warning: "bg-warning text-bg",
        danger: "bg-danger text-bg",
        info: "bg-info text-bg",
        neutral: "bg-surface-3 text-dim",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
