"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition cursor-pointer select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white font-semibold shadow-[0_6px_20px_rgba(108,123,250,.35)] hover:brightness-110",
        white: "bg-white text-surface font-semibold hover:brightness-90",
        ghost:
          "bg-line/[.05] border border-line/10 text-ink-2 hover:bg-line/10",
        subtle: "bg-line/[.04] border border-line/[.09] text-ink-3 hover:bg-line/[.08]",
        success:
          "bg-success/10 border border-success/30 text-ink-2 font-semibold hover:bg-success/20",
        danger:
          "border border-danger/35 text-danger-soft font-semibold hover:bg-danger/10",
        outline: "border border-line/10 text-ink-3 hover:bg-line/[.06]",
        plain: "text-mute hover:bg-line/[.05] hover:text-ink-2",
      },
      size: {
        sm: "text-xs rounded-[9px] px-3 py-1.5",
        md: "text-[12.5px] rounded-[10px] px-3.5 py-2",
        lg: "text-[13.5px] rounded-[10px] px-4.5 py-2.5",
        xl: "text-[15px] rounded-2xl px-5 py-3.5 font-bold",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
