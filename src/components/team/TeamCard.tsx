"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";

interface TeamCardProps {
  team: Team;
  onClick?: () => void;
}

function statusColor(team: Team) {
  switch (team.status) {
    case "ready":
      return "text-success";
    case "requesting":
      return "text-accent";
    case "active_power_card":
      return "text-info";
    case "offline":
      return "text-danger-soft";
    default:
      return "text-mute-2";
  }
}

/* Team row for the console right rail — rank, live state, score, and manual marks. */
export function TeamCard({ team, onClick }: TeamCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 bg-card border rounded-xl px-3 py-2.5 cursor-pointer transition-colors",
        team.status === "active_power_card" ? "border-[rgba(108,160,232,.25)]" : "border-line/[.07] hover:border-line/[.16]",
        team.status === "offline" && "opacity-60"
      )}
    >
      <span
        className={cn(
          "font-mono font-semibold text-[11px]",
          team.rank === 1 ? "text-warn" : "text-mute"
        )}
      >
        {team.rank}
      </span>
      <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: team.color }} />
      <div className="flex flex-col min-w-0">
        <span className="text-[12.5px] font-semibold text-ink">{team.name}</span>
        {team.statusDetail && (
          <span className={cn("text-[10px] flex items-center gap-1", statusColor(team))}>
            {team.status === "active_power_card" && <Icon name="clock-plus" size={10} />}
            {team.status === "requesting" && <Icon name="sparkles" size={10} />}
            {team.statusDetail}
          </span>
        )}
      </div>
      <span className="font-mono font-semibold text-sm text-ink ml-auto">{team.score}</span>
      {team.status !== "offline" && (
        <div className="flex gap-1">
          <button className="w-6 h-6 rounded-[7px] bg-success/[.12] text-success inline-flex items-center justify-center text-[11px] font-bold hover:bg-success/25 cursor-pointer">
            +
          </button>
          <button className="w-6 h-6 rounded-[7px] bg-danger/10 text-danger-soft inline-flex items-center justify-center text-[11px] font-bold hover:bg-danger/[.22] cursor-pointer">
            −
          </button>
        </div>
      )}
    </div>
  );
}
