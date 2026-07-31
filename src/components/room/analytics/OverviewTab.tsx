"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import type { OverviewRow } from "@/data/queries/analytics.queries";

type SortKey = keyof Pick<
  OverviewRow,
  "rank" | "name" | "score" | "coins" | "powerCardsRemaining" | "correctAnswers" | "wrongAnswers" | "streak"
>;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Team" },
  { key: "score", label: "Score" },
  { key: "coins", label: "Coins" },
  { key: "powerCardsRemaining", label: "Power Cards" },
  { key: "correctAnswers", label: "Correct" },
  { key: "wrongAnswers", label: "Wrong" },
  { key: "streak", label: "Streak" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function OverviewTab({
  rows,
  search,
  onSelectTeam,
}: {
  rows: OverviewRow[];
  search: string;
  onSelectTeam: (teamId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = rows.filter((r) => !search || r.name.toLowerCase().includes(search));
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sortDir;
    return (Number(av) - Number(bv)) * sortDir;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "rank" ? 1 : -1);
    }
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line/[.08]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2 cursor-pointer select-none hover:text-ink-3 whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && <Icon name={sortDir === 1 ? "chevron-up" : "chevron-down"} size={11} />}
                  </span>
                </th>
              ))}
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2 whitespace-nowrap">Last Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.teamId}
                onClick={() => onSelectTeam(row.teamId)}
                className="border-b border-line/[.05] cursor-pointer hover:bg-line/[.03] transition-colors"
              >
                <td className="px-3.5 py-2.5 text-[12.5px] font-black text-mute-2">#{row.rank || "—"}</td>
                <td className="px-3.5 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color ?? "#6C7BFA" }} />
                    <span className="text-[13px] font-bold text-ink">{row.name}</span>
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-[13px] font-black text-ink tabular-nums">{row.score}</td>
                <td className="px-3.5 py-2.5 text-[12.5px] font-semibold text-warn tabular-nums">{row.coins}</td>
                <td className="px-3.5 py-2.5 text-[12.5px] text-accent tabular-nums">{row.powerCardsRemaining}</td>
                <td className="px-3.5 py-2.5 text-[12.5px] text-success tabular-nums">{row.correctAnswers}</td>
                <td className="px-3.5 py-2.5 text-[12.5px] text-danger-soft tabular-nums">{row.wrongAnswers}</td>
                <td className="px-3.5 py-2.5 text-[12.5px] tabular-nums">
                  {row.streak >= 3 ? `🔥 x${row.streak}` : row.streak > 0 ? `x${row.streak}` : "—"}
                </td>
                <td className="px-3.5 py-2.5 text-[12px] whitespace-nowrap">
                  {row.lastActionPoints !== null ? (
                    <span className={row.lastActionPoints >= 0 ? "text-success font-bold" : "text-danger-soft font-bold"}>
                      {row.lastActionPoints >= 0 ? "+" : ""}
                      {row.lastActionPoints}
                    </span>
                  ) : (
                    "—"
                  )}
                  <span className="text-dim ml-1.5">{timeAgo(row.lastActionAt)}</span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3.5 py-8 text-center text-[12.5px] text-mute-2">
                  No teams match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
