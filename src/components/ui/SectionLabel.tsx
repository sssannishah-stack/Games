import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/* The tiny mono uppercase label used everywhere in the design. */
export function SectionLabel({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "font-mono font-semibold text-[9.5px] tracking-[.13em] text-label flex items-center gap-1.5",
        className
      )}
      {...props}
    />
  );
}
