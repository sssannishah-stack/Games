import { cn } from "@/lib/utils";

interface TimerRingProps {
  value: number | string;
  size?: number;
  color?: string;
  className?: string;
}

/* Circular countdown ring — border trick, matching the design exactly. */
export function TimerRing({ value, size = 52, color = "var(--color-accent)", className }: TimerRingProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-mono font-semibold text-ink shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        border: `${Math.max(3, size / 15)}px solid ${color}`,
        borderBottomColor: "rgba(255,255,255,.1)",
        fontSize: size / 3,
      }}
    >
      {value}
    </div>
  );
}
