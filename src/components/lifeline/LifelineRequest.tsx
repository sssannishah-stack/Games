"use client";

import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { ApprovalRequest } from "@/types";
import { getTeam } from "@/data/mock/teams";

const POWER_CARD_META: Record<string, { icon: string; color: string; verb: string }> = {
  freeze: { icon: "snowflake", color: "#7EB5F0", verb: "Freeze" },
  hint: { icon: "lightbulb", color: "#F5B93D", verb: "Hint" },
  shield: { icon: "shield", color: "#3DD68C", verb: "Shield" },
  double: { icon: "zap", color: "#6C7BFA", verb: "2× Points" },
  "extra-time": { icon: "clock-plus", color: "#8A8F9C", verb: "Extra time" },
  mystery: { icon: "gift", color: "#E8A33D", verb: "Mystery box" },
};

interface PowerCardRequestTileProps {
  request: ApprovalRequest;
  pendingCount?: number;
  extraNote?: string;
}

/* Accent-tinted power card request tile with Approve / Reject / Override. */
export function PowerCardRequestTile({ request, pendingCount, extraNote }: PowerCardRequestTileProps) {
  const meta = POWER_CARD_META[request.powerCard];
  const from = getTeam(request.fromTeamId);
  const target = request.targetTeamId ? getTeam(request.targetTeamId) : undefined;

  return (
    <div className="bg-[linear-gradient(120deg,color-mix(in_oklab,#6C7BFA_12%,#101218),#101218)] border border-accent/45 rounded-[14px] px-3.5 py-3 flex flex-col gap-2.5">
      <SectionLabel className="text-[#B4BCFC]">
        <Icon name="sparkles" size={12} />
        PENDING POWER CARDS{pendingCount != null && ` · ${pendingCount}`}
      </SectionLabel>
      <div className="flex items-center gap-2">
        <Icon name={meta.icon} size={14} style={{ color: meta.color }} />
        <span className="text-xs text-ink-2">
          <b>{from?.name}</b> requested {meta.verb}
          {target && (
            <>
              {" "}on <b>{target.name}</b>
            </>
          )}
        </span>
        <span className="font-mono font-medium text-[9.5px] text-mute-2 ml-auto">
          {request.secondsAgo}s
        </span>
      </div>
      <div className="flex gap-1.5">
        <button className="flex-1 text-center bg-accent text-white rounded-lg py-[7px] text-[11.5px] font-semibold hover:brightness-110 cursor-pointer">
          Approve · A
        </button>
        <button className="flex-1 text-center bg-line/[.05] border border-line/10 text-ink-3 rounded-lg py-[7px] text-[11.5px] font-medium hover:bg-line/10 cursor-pointer">
          Reject · X
        </button>
        <button className="text-center bg-line/[.05] border border-line/10 text-ink-3 rounded-lg py-[7px] px-2.5 text-[11.5px] font-medium hover:bg-line/10 cursor-pointer">
          Override
        </button>
      </div>
      {extraNote && (
        <span className="text-[10.5px] text-mute-2">
          {extraNote} · <span className="text-[#B4BCFC] font-semibold">open Approvals</span>
        </span>
      )}
    </div>
  );
}
