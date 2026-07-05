"use client";

import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PowerCardTile } from "@/components/lifeline/LifelineCard";
import { mockPowerCards, mockScoreHistory } from "@/data/mock/live";
import type { Team } from "@/types";
import { cn } from "@/lib/utils";

interface TeamInventoryProps {
  team: Team;
  onClose?: () => void;
  onGiveMarks?: () => void;
}

/* V2-03 · Team inventory drawer — score, members, cards, explained history. */
export function TeamInventory({ team, onClose, onGiveMarks }: TeamInventoryProps) {
  const stats = [
    { label: "SCORE", value: String(team.score) },
    { label: "RANK", value: `#${team.rank}`, suffix: "of 6" },
    { label: "STREAK", value: `🔥 ${team.streak ?? 0}`, color: "#F5B93D" },
    { label: "ACCURACY", value: `${team.accuracy ?? 0}%`, color: "#3DD68C" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* header */}
      <div
        className="px-6 pt-5 pb-4 border-b border-line/[.06]"
        style={{
          background: `linear-gradient(140deg, color-mix(in oklab, ${team.color} 14%, transparent), transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-[46px] h-[46px] rounded-[14px] border-[1.5px] flex items-center justify-center text-[17px] font-bold text-white"
            style={{
              background: `color-mix(in oklab, ${team.color} 30%, #14161E)`,
              borderColor: team.color,
            }}
          >
            {team.name.charAt(0)}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold text-ink tracking-[-.015em]">Team {team.name}</span>
            <span className="text-[11.5px] text-mute">
              {team.members.length} members
              {team.members.find((m) => m.isCaptain) &&
                ` · ${team.members.find((m) => m.isCaptain)!.name} is captain`}
              {team.mentor && ` · mentor: ${team.mentor}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="flex gap-2.5 mt-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex-1 bg-line/[.04] border border-line/[.08] rounded-xl px-3.5 py-2.5 flex flex-col gap-px"
            >
              <span className="font-mono font-semibold text-[9px] tracking-[.12em] text-dim-2">
                {s.label}
              </span>
              <span
                className="font-mono font-bold text-xl text-ink"
                style={s.color ? { color: s.color } : undefined}
              >
                {s.value}{" "}
                {s.suffix && <span className="text-[11px] text-dim">{s.suffix}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3.5 flex flex-col gap-3.5 overflow-y-auto flex-1">
        {/* members */}
        <div className="flex flex-col gap-2">
          <SectionLabel>MEMBERS · {team.members.length} ONLINE</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {team.members.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-[7px] text-xs text-ink-2 bg-line/[.04] border border-line/[.09] rounded-full py-[5px] pl-1.5 pr-3"
              >
                <span
                  className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: m.gradient }}
                >
                  {m.initial}
                </span>
                {m.name}
                {m.isCaptain && <Icon name="crown" size={11} className="text-warn" />}
              </span>
            ))}
          </div>
        </div>

        {/* power card inventory */}
        <div className="flex flex-col gap-2">
          <SectionLabel>POWER CARD INVENTORY</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {mockPowerCards.map((c) => (
              <PowerCardTile key={c.id} card={c} size="sm" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-dim">Host can grant or revoke cards:</span>
            <button className="text-[11px] font-semibold text-accent flex items-center gap-1 hover:brightness-125 cursor-pointer">
              <Icon name="plus" size={12} />
              Grant card
            </button>
          </div>
        </div>

        {/* score history */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <SectionLabel>SCORE HISTORY — EVERY POINT EXPLAINED</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {mockScoreHistory.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2.5 bg-line/[.025] border border-line/[.06] rounded-[10px] px-3 py-2 group"
              >
                <span
                  className={cn(
                    "font-mono font-bold text-[13px] w-[38px]",
                    e.delta >= 0 ? "text-success" : "text-danger-soft"
                  )}
                >
                  {e.delta >= 0 ? `+${e.delta}` : `−${Math.abs(e.delta)}`}
                </span>
                <div className="flex flex-col">
                  <span className="text-xs text-ink-2">{e.reason}</span>
                  <span className="text-[10px] text-dim-2">
                    {e.by} · {e.at}
                  </span>
                </div>
                <button className="ml-auto text-[10.5px] text-dim-2 flex items-center gap-1 hover:text-danger-soft cursor-pointer">
                  <Icon name="undo-2" size={11} />
                  undo
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* footer actions */}
      <div className="flex gap-2 px-6 py-3.5 border-t border-line/[.06] bg-line/[.015]">
        <button
          onClick={onGiveMarks}
          className="flex-1 flex items-center justify-center gap-[7px] bg-accent rounded-[10px] py-2.5 text-[13px] font-semibold text-white hover:brightness-110 cursor-pointer"
        >
          <Icon name="badge-plus" size={14} />
          Give marks
        </button>
        <button className="flex-1 flex items-center justify-center gap-[7px] bg-line/[.04] border border-line/[.09] rounded-[10px] py-2.5 text-[13px] font-medium text-ink-3 hover:bg-line/[.08] cursor-pointer">
          <Icon name="message-square" size={14} />
          Message team
        </button>
        <button className="flex items-center justify-center gap-[7px] bg-line/[.04] border border-line/[.09] rounded-[10px] py-2.5 px-3.5 text-[13px] font-medium text-ink-3 hover:bg-line/[.08] cursor-pointer">
          <Icon name="snowflake" size={14} className="text-info" />
          Freeze
        </button>
      </div>
    </div>
  );
}
