import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/* Keyboard shortcut chip. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "font-mono font-medium text-[9.5px] bg-line/[.06] rounded px-1.5 py-px text-dim",
        className
      )}
      {...props}
    />
  );
}
