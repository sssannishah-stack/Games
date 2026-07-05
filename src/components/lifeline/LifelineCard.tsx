"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { PowerCard } from "@/types";

interface PowerCardTileProps {
  card: PowerCard;
  size?: "sm" | "lg"; // sm = inventory drawer grid · lg = participant wallet
}

/* One power card with the host-approved lifecycle state. */
export function PowerCardTile({ card, size = "sm" }: PowerCardTileProps) {
  const l = card;
  const requested = l.state === "requested";
  const approved = l.state === "approved";
  const active = l.state === "active";
  const consumed = l.state === "consumed";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl transition",
        size === "sm"
          ? "bg-elev px-3 py-[11px] gap-[5px] rounded-xl"
          : "bg-[linear-gradient(160deg,#161A24,#10121A)] p-[13px] gap-1.5 hover:-translate-y-0.5",
        requested
          ? "border-[1.5px] border-accent shadow-[0_0_0_4px_rgba(108,123,250,.12)]"
          : active
            ? "border-[1.5px] border-success shadow-[0_0_0_4px_rgba(61,214,140,.12)]"
          : consumed
            ? "border border-line/[.09] opacity-55"
            : "border",
        !requested && !active && !consumed && "hover:border-opacity-60"
      )}
      style={
        !requested && !active && !consumed
          ? { borderColor: `color-mix(in oklab, ${l.color} 35%, transparent)` }
          : undefined
      }
    >
      {size === "lg" ? (
        <>
          <Icon name={l.icon} size={22} style={{ color: consumed ? "#8A8F9C" : l.color }} />
          <span className="text-[13px] font-bold text-ink">
            {l.name}{" "}
            <span className="font-mono font-semibold text-[10px] text-mute-2">×{l.count}</span>
          </span>
          <span className="text-[10px] text-mute-2 leading-relaxed">{l.description}</span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-[7px]">
            <Icon name={l.icon} size={15} style={{ color: consumed ? "#8A8F9C" : l.color }} />
            <span className="text-xs font-semibold text-ink-2">{l.name}</span>
            <span className="font-mono font-semibold text-[10px] text-mute-2 ml-auto">
              ×{l.count}
            </span>
          </div>
          <span className="text-[10px] text-dim">{l.description}</span>
        </>
      )}
      <span
        className={cn(
          "text-[9px] font-semibold rounded-[5px] px-1.5 py-0.5 self-start",
          requested && "text-accent bg-accent/[.14] animate-enc-pulse-slow",
          approved && "text-[#B4BCFC] bg-accent/[.1]",
          active && "text-success bg-success/10 animate-enc-pulse-slow",
          consumed && "text-mute-2 bg-line/[.06]",
          l.state === "available" && "text-success bg-success/10"
        )}
      >
        {l.state === "available" && "AVAILABLE"}
        {requested && "REQUESTED"}
        {approved && "APPROVED"}
        {active && "ACTIVE"}
        {consumed && `CONSUMED · ${l.usedOn}`}
      </span>
    </div>
  );
}
