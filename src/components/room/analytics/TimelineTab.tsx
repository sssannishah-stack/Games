"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { TimelineEntry } from "@/data/queries/analytics.queries";
import type { EventLogType } from "@/types/db";

type FilterGroup = "ALL" | "SCORE" | "POWER" | "STORE" | "AUCTION" | "BROADCAST" | "GENERAL";

const GROUP_OF: Partial<Record<EventLogType, FilterGroup>> = {
  SCORE_CHANGED: "SCORE",
  ACHIEVEMENT_EARNED: "SCORE",
  POWER_CARD_REQUESTED: "POWER",
  POWER_CARD_USED: "POWER",
  CARD_PURCHASED: "STORE",
  STORE_OPENED: "STORE",
  STORE_CLOSED: "STORE",
  FLASH_SALE_STARTED: "STORE",
  REWARD_DROP: "STORE",
  COIN_AWARDED: "STORE",
  AUCTION_STARTED: "AUCTION",
  AUCTION_SOLD: "AUCTION",
  AUCTION_CANCELLED: "AUCTION",
  LUCKY_SPIN: "AUCTION",
  BROADCAST_SENT: "BROADCAST",
};

const FILTERS: FilterGroup[] = ["ALL", "SCORE", "POWER", "STORE", "AUCTION", "BROADCAST", "GENERAL"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimelineTab({ entries, search }: { entries: TimelineEntry[]; search: string }) {
  const [filter, setFilter] = useState<FilterGroup>("ALL");

  const filtered = entries.filter((e) => {
    const group = GROUP_OF[e.type] ?? "GENERAL";
    if (filter !== "ALL" && group !== filter) return false;
    if (search && !e.text.toLowerCase().includes(search) && !(e.teamName ?? "").toLowerCase().includes(search)) return false;
    return true;
  });

  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold cursor-pointer transition-colors ${
              filter === f ? "bg-accent/15 border border-accent/40 text-ink" : "border border-line/[.09] bg-line/[.02] text-mute-2 hover:text-ink-3"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <span className="text-[12.5px] text-mute-2 py-6 text-center">No events match.</span>
      ) : (
        <div className="flex flex-col max-h-[560px] overflow-y-auto encore-scrollbar">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2.5 border-b border-line/[.05] py-2 last:border-0">
              <span className="font-mono text-[10px] text-dim-2 tabular-nums w-10 shrink-0">{fmtTime(entry.createdAt)}</span>
              {entry.teamColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: entry.teamColor }} />}
              <span className="text-[12px] text-ink-3 truncate">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
