"use client";

import { Card } from "@/components/ui/Card";
import type { EconomyRow } from "@/data/queries/analytics.queries";

export function EconomyTab({
  rows,
  search,
  onSelectTeam,
}: {
  rows: EconomyRow[];
  search: string;
  onSelectTeam: (teamId: string) => void;
}) {
  const filtered = rows.filter((r) => !search || r.name.toLowerCase().includes(search));

  if (filtered.length === 0) {
    return (
      <Card className="rounded-2xl p-8 text-center text-[12.5px] text-mute-2">
        No coin activity yet — economy mode may be off for this room, or the event hasn't started.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {filtered.map((row) => (
        <Card
          key={row.teamId}
          onClick={() => onSelectTeam(row.teamId)}
          className="rounded-2xl p-4 flex flex-col gap-2.5 cursor-pointer hover:border-accent/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color ?? "#6C7BFA" }} />
            <span className="text-[13.5px] font-bold text-ink truncate">{row.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-line/[.03] border border-line/[.07] px-3 py-2">
              <span className="block text-[9.5px] font-semibold tracking-[.08em] text-mute-2">STARTED</span>
              <span className="text-[15px] font-black text-ink tabular-nums">{row.byType.STARTING_BONUS ?? 0}</span>
            </div>
            <div className="rounded-xl bg-success/[.06] border border-success/20 px-3 py-2">
              <span className="block text-[9.5px] font-semibold tracking-[.08em] text-success">EARNED</span>
              <span className="text-[15px] font-black text-success tabular-nums">+{row.earned}</span>
            </div>
            <div className="rounded-xl bg-danger/[.06] border border-danger/20 px-3 py-2">
              <span className="block text-[9.5px] font-semibold tracking-[.08em] text-danger-soft">SPENT</span>
              <span className="text-[15px] font-black text-danger-soft tabular-nums">−{row.spent}</span>
            </div>
            <div className="rounded-xl bg-warn/[.08] border border-warn/25 px-3 py-2">
              <span className="block text-[9.5px] font-semibold tracking-[.08em] text-warn">CURRENT</span>
              <span className="text-[15px] font-black text-warn tabular-nums">{row.current}</span>
            </div>
          </div>
          {(row.byType.CARD_PURCHASE ?? 0) !== 0 && (
            <span className="text-[10.5px] text-mute-2">
              Store purchases: {Math.abs(row.byType.CARD_PURCHASE ?? 0)} coins
            </span>
          )}
        </Card>
      ))}
    </div>
  );
}
