"use client";

import { Fragment, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import type { RoundBreakdown } from "@/data/queries/analytics.queries";

const REASON_LABEL: Record<string, string> = {
  CORRECT: "✓ Correct",
  WRONG: "✗ Wrong",
  BONUS: "★ Bonus",
  PENALTY: "Penalty",
  POWER_CARD: "⚡ Power",
  MANUAL: "Manual",
};

export function RoundBreakdownTab({
  breakdown,
  search,
  onSelectTeam,
}: {
  breakdown: RoundBreakdown;
  search: string;
  onSelectTeam: (teamId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { rounds, teams, matrix, totals, detail } = breakdown;

  const visibleRounds = rounds.filter((round) => {
    if (!search) return true;
    if (round.title.toLowerCase().includes(search)) return true;
    return (detail[round.roundId] ?? []).some((q) => q.questionText.toLowerCase().includes(search));
  });

  if (teams.length === 0 || rounds.length === 0) {
    return (
      <Card className="rounded-2xl p-8 text-center text-[12.5px] text-mute-2">
        Round breakdown appears once this room has rounds selected and at least one scored question.
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line/[.08]">
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2 whitespace-nowrap">Round</th>
              {teams.map((team) => (
                <th
                  key={team.id}
                  onClick={() => onSelectTeam(team.id)}
                  className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2 whitespace-nowrap cursor-pointer hover:text-ink-3"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
                    {team.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRounds.map((round) => {
              const isOpen = expanded === round.roundId;
              const rows = detail[round.roundId] ?? [];
              const filteredRows = search ? rows.filter((r) => r.questionText.toLowerCase().includes(search) || round.title.toLowerCase().includes(search)) : rows;
              return (
                <Fragment key={round.roundId}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : round.roundId)}
                    className="border-b border-line/[.05] cursor-pointer hover:bg-line/[.03] transition-colors"
                  >
                    <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-ink">
                      <span className="flex items-center gap-1.5">
                        <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={13} className="text-dim" />
                        {round.title}
                      </span>
                    </td>
                    {teams.map((team) => {
                      const points = matrix[round.roundId]?.[team.id] ?? 0;
                      return (
                        <td key={team.id} className="px-3.5 py-2.5 text-[13px] font-bold tabular-nums">
                          <span className={points > 0 ? "text-success" : points < 0 ? "text-danger-soft" : "text-mute-2"}>
                            {points > 0 ? "+" : ""}
                            {points}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {isOpen && (
                    <tr className="bg-line/[.02]">
                      <td colSpan={teams.length + 1} className="px-3.5 py-3">
                        {filteredRows.length === 0 ? (
                          <span className="text-[12px] text-mute-2">No scored questions in this round yet.</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {filteredRows.map((row, i) => {
                              const team = teams.find((t) => t.id === row.teamId);
                              return (
                                <div key={i} className="flex items-center gap-2.5 rounded-lg bg-line/[.03] px-3 py-1.5">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team?.color ?? "#6C7BFA" }} />
                                  <span className="text-[11.5px] font-semibold text-ink-3 truncate flex-1">{row.questionText}</span>
                                  <span className="text-[10.5px] text-mute-2 shrink-0">{team?.name}</span>
                                  <span className="text-[10.5px] text-dim shrink-0">{REASON_LABEL[row.reason] ?? row.reason}</span>
                                  <span className={`text-[12px] font-bold tabular-nums shrink-0 ${row.points >= 0 ? "text-success" : "text-danger-soft"}`}>
                                    {row.points >= 0 ? "+" : ""}
                                    {row.points}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line/[.1] bg-line/[.02]">
              <td className="px-3.5 py-2.5 text-[12px] font-black tracking-[.06em] text-ink-2">ROUND TOTAL</td>
              {teams.map((team) => (
                <td key={team.id} className="px-3.5 py-2.5 text-[13.5px] font-black text-ink tabular-nums">
                  {totals[team.id] ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
