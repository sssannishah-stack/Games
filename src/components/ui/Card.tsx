import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/* The base panel used across the design: #101218 with a hairline border. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card border border-line/[.07] rounded-[14px]",
        className
      )}
      {...props}
    />
  );
}
