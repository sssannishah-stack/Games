"use client";

import { cn } from "@/lib/utils";
import type { Team } from "@/types";

interface TeamChipProps {
  team: Team;
  selected?: boolean;
  onClick?: () => void;
  suffix?: string; // small mono hint, e.g. keyboard number
  className?: string;
}

/* Pill with team color dot — selection glows in the team's own color. */
export function TeamChip({ team, selected, onClick, suffix, className }: TeamChipProps) {
  return (
    <button
      onClick={onClick}
      style={
        selected
          ? {
              background: `color-mix(in oklab, ${team.color} 26%, transparent)`,
              borderColor: team.color,
              boxShadow: `0 0 0 3px color-mix(in oklab, ${team.color} 12%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "flex items-center justify-center gap-1.5 text-xs rounded-full px-2.5 py-1 border cursor-pointer transition",
        selected
          ? "font-bold text-white border-[1.5px]"
          : "text-ink-3 border-line/10 hover:border-line/25",
        className
      )}
    >
      <span
        className="w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: team.color }}
      />
      {team.name}
      {suffix && (
        <span className="font-mono font-medium text-[10px] text-dim-2">{suffix}</span>
      )}
    </button>
  );
}
