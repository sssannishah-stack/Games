"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { ReplayEvent } from "@/data/queries/replay.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { EventLogType } from "@/types/db";

type FilterGroup = "ALL" | "QUESTIONS" | "SCORES" | "COINS" | "POWER" | "STORE" | "AUCTION" | "BROADCAST" | "LEADERBOARD";

const GROUP_OF: Partial<Record<EventLogType, FilterGroup>> = {
  SCENE_CHANGED: "QUESTIONS",
  ANSWER_REVEALED: "QUESTIONS",
  SCORE_CHANGED: "SCORES",
  ACHIEVEMENT_EARNED: "SCORES",
  COIN_AWARDED: "COINS",
  POWER_CARD_REQUESTED: "POWER",
  POWER_CARD_USED: "POWER",
  CARD_PURCHASED: "POWER",
  STORE_OPENED: "STORE",
  STORE_CLOSED: "STORE",
  FLASH_SALE_STARTED: "STORE",
  REWARD_DROP: "STORE",
  AUCTION_STARTED: "AUCTION",
  AUCTION_SOLD: "AUCTION",
  AUCTION_CANCELLED: "AUCTION",
  LUCKY_SPIN: "AUCTION",
  BROADCAST_SENT: "BROADCAST",
};

const FILTERS: FilterGroup[] = ["ALL", "QUESTIONS", "SCORES", "COINS", "POWER", "STORE", "AUCTION", "BROADCAST"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimelinePanel({
  events,
  teams,
  cards,
  cursorIndex,
  onJump,
}: {
  events: ReplayEvent[];
  teams: TeamRecord[];
  cards: PowerCardRecord[];
  cursorIndex: number;
  onJump: (index: number) => void;
}) {
  const [filter, setFilter] = useState<FilterGroup>("ALL");
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const teamColorById = new Map(teams.map((t) => [t.id, t.color]));
  const cardNameById = new Map(cards.map((c) => [c.id, c.name]));

  function resolvedText(event: ReplayEvent): string {
    const teamId = event.metadata.teamId ? String(event.metadata.teamId) : null;
    const cardId = event.metadata.powerCardId ? String(event.metadata.powerCardId) : null;
    const teamName = teamId ? teamNameById.get(teamId) ?? "A team" : null;
    const cardName = cardId ? cardNameById.get(cardId) : null;
    let text = event.text;
    if (cardName) text = text.replace(/power card/i, cardName);
    return teamName ? `${teamName} — ${text}` : text;
  }

  const filtered = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => filter === "ALL" || (GROUP_OF[event.type] ?? null) === filter);

  return (
    <Card className="rounded-2xl p-3 flex flex-col gap-2.5 h-full min-h-0">
      <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label px-1">TIMELINE</span>
      <div className="flex items-center gap-1 flex-wrap px-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold cursor-pointer transition-colors ${
              filter === f ? "bg-accent/15 border border-accent/40 text-ink" : "border border-line/[.09] bg-line/[.02] text-mute-2 hover:text-ink-3"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto encore-scrollbar flex flex-col gap-1 px-1">
        {filtered.length === 0 ? (
          <span className="text-[11.5px] text-mute-2 py-4 text-center">No events match.</span>
        ) : (
          filtered.map(({ event, index }) => {
            const isCursor = index === cursorIndex;
            const teamId = event.metadata.teamId ? String(event.metadata.teamId) : null;
            const color = teamId ? teamColorById.get(teamId) : null;
            return (
              <button
                key={event.id}
                onClick={() => onJump(index)}
                className={`text-left rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer ${
                  isCursor ? "bg-accent/15 border border-accent/40" : "border border-transparent hover:bg-line/[.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9.5px] text-dim-2 tabular-nums shrink-0">{fmtTime(event.createdAt)}</span>
                  {color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
                  <span className={`text-[11.5px] truncate ${isCursor ? "text-ink font-semibold" : "text-ink-3"}`}>{resolvedText(event)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
