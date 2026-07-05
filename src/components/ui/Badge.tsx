import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "text-mute bg-line/[.05] border border-line/[.08]",
        success: "text-success bg-success/10 border border-success/[.22] font-medium",
        warn: "text-warn bg-warn/[.09] border border-warn/[.22] font-medium",
        accent: "text-accent bg-accent/15 font-semibold tracking-[.14em] font-mono",
        live: "text-live bg-danger/10 border border-danger/30 font-bold tracking-[.12em] font-mono",
        plain: "text-mute bg-line/[.05]",
      },
      size: {
        sm: "text-[10.5px] px-2.5 py-[3px]",
        md: "text-xs px-[11px] py-[5px]",
        lg: "text-xs px-[13px] py-1.5",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
