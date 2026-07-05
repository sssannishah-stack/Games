import { icons } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export type IconName = string;

function toPascal(name: string) {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

interface IconProps {
  name: IconName; // kebab-case lucide name, as used in the design ("badge-plus")
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

export function Icon({ name, size = 14, className, style, strokeWidth = 2 }: IconProps) {
  const Cmp = icons[toPascal(name) as keyof typeof icons];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      style={style}
    />
  );
}
