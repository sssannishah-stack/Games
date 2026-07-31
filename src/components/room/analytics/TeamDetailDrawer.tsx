"use client";

import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { AnalyticsBundle } from "./AnalyticsCenter";
import { computeRankTimeline, computeGreatestComeback } from "./rankChanges";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-bold tracking-[.1em] text-mute-2">{title.toUpperCase()}</span>
      {children}
    </div>
  );
}

export function TeamDetailDrawer({
  team,
  analytics,
  onClose,
}: {
  team: TeamRecord;
  analytics: AnalyticsBundle;
  onClose: () => void;
}) {
  const { roundBreakdown, economy, powerCardUsage, timeline, achievements } = analytics;
  const rounds = roundBreakdown.rounds;
  const roundPoints = rounds.map((r) => roundBreakdown.matrix[r.roundId]?.[team.id] ?? 0);
  const maxAbsRound = Math.max(1, ...roundPoints.map((p) => Math.abs(p)));

  const track = computeRankTimeline(roundBreakdown).find((t) => t.teamId === team.id);
  const comeback = computeGreatestComeback(roundBreakdown);
  const isComebackTeam = comeback?.teamId === team.id;

  const questionRows = rounds.flatMap((r) => (roundBreakdown.detail[r.roundId] ?? []).filter((q) => q.teamId === team.id).map((q) => ({ ...q, roundTitle: r.title })));

  const economyRow = economy.find((e) => e.teamId === team.id);
  const cardRows = powerCardUsage.filter((r) => r.teamId === team.id);
  const teamTimeline = timeline.filter((e) => e.teamName === team.name);
  const teamAchievements = achievements.filter((a) => a.teamId === team.id);

  return (
    <Drawer open={Boolean(team)} onClose={onClose} className="max-w-[440px]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line/[.08] shrink-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
        <span className="text-[16px] font-bold text-ink truncate">{team.name}</span>
        {isComebackTeam && (
          <span className="text-[10px] font-bold text-warn bg-warn/10 border border-warn/25 rounded-full px-2 py-0.5 shrink-0">
            🚀 Greatest Comeback
          </span>
        )}
        <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-mute-2 hover:bg-line/[.06] cursor-pointer">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <Section title="General">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-line/[.04] border border-line/[.08] px-3 py-2">
              <span className="block text-[9px] text-mute-2">RANK</span>
              <span className="text-[16px] font-black text-ink">#{team.rank || "—"}</span>
            </div>
            <div className="rounded-xl bg-line/[.04] border border-line/[.08] px-3 py-2">
              <span className="block text-[9px] text-mute-2">SCORE</span>
              <span className="text-[16px] font-black text-ink">{team.score}</span>
            </div>
            <div className="rounded-xl bg-line/[.04] border border-line/[.08] px-3 py-2">
              <span className="block text-[9px] text-mute-2">COINS</span>
              <span className="text-[16px] font-black text-warn">{team.coins}</span>
            </div>
          </div>
        </Section>

        {team.members.length > 0 && (
          <Section title="Members">
            <div className="flex flex-wrap gap-1.5">
              {team.members.map((m, i) => (
                <span key={i} className="text-[11px] font-semibold text-ink-3 bg-line/[.04] border border-line/[.08] rounded-full px-2.5 py-1">
                  {m.name}
                </span>
              ))}
            </div>
          </Section>
        )}

        {rounds.length > 0 && (
          <Section title="Round scores">
            <div className="flex flex-col gap-1.5">
              {rounds.map((round, i) => {
                const points = roundPoints[i];
                const widthPct = (Math.abs(points) / maxAbsRound) * 100;
                const rank = track?.ranks[i];
                const prevRank = i > 0 ? track?.ranks[i - 1] : null;
                const arrow = prevRank == null || rank == null ? null : rank < prevRank ? "up" : rank > prevRank ? "down" : "same";
                return (
                  <div key={round.roundId} className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-3 w-20 truncate shrink-0">{round.title}</span>
                    <div className="flex-1 h-4 rounded bg-line/[.05] overflow-hidden">
                      <div
                        className={`h-full rounded ${points >= 0 ? "bg-success/60" : "bg-danger/60"}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold w-9 text-right shrink-0 ${points >= 0 ? "text-success" : "text-danger-soft"}`}>
                      {points >= 0 ? "+" : ""}
                      {points}
                    </span>
                    {arrow && (
                      <span className={`text-[10px] shrink-0 ${arrow === "up" ? "text-success" : arrow === "down" ? "text-danger-soft" : "text-dim"}`}>
                        #{rank} {arrow === "up" ? "↑" : arrow === "down" ? "↓" : "–"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {questionRows.length > 0 && (
          <Section title="Question history">
            <div className="flex flex-col gap-1">
              {questionRows.map((q, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] py-1 border-b border-line/[.05] last:border-0">
                  <span className="text-ink-3 truncate flex-1">{q.questionText}</span>
                  <span className="text-dim shrink-0">{q.roundTitle}</span>
                  <span className={`font-bold shrink-0 ${q.points >= 0 ? "text-success" : "text-danger-soft"}`}>
                    {q.points >= 0 ? "+" : ""}
                    {q.points}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {economyRow && (
          <Section title="Coins">
            <div className="grid grid-cols-2 gap-2 text-[11.5px]">
              <span className="text-mute-2">Earned <b className="text-success">+{economyRow.earned}</b></span>
              <span className="text-mute-2">Spent <b className="text-danger-soft">−{economyRow.spent}</b></span>
            </div>
          </Section>
        )}

        {cardRows.length > 0 && (
          <Section title="Power cards">
            <div className="flex flex-col gap-1">
              {cardRows.map((c) => (
                <div key={c.powerCardId} className="flex items-center gap-2 text-[11.5px]">
                  <Icon name={c.powerCardIcon} size={12} className="text-accent shrink-0" />
                  <span className="text-ink-3 flex-1 truncate">{c.powerCardName}</span>
                  <span className="text-dim">{c.used} used · {c.remaining} left</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {teamAchievements.length > 0 && (
          <Section title="Achievements">
            <div className="flex flex-wrap gap-1.5">
              {teamAchievements.map((a) => (
                <span key={a.id} className="text-[11px] font-semibold bg-line/[.04] border border-line/[.08] rounded-full px-2.5 py-1">
                  {ACHIEVEMENTS[a.type].emoji} {ACHIEVEMENTS[a.type].label}
                </span>
              ))}
            </div>
          </Section>
        )}

        {teamTimeline.length > 0 && (
          <Section title="Timeline">
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto encore-scrollbar">
              {teamTimeline.map((e) => (
                <span key={e.id} className="text-[11px] text-mute-2">
                  {new Date(e.createdAt).toLocaleTimeString()} — {e.text}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Drawer>
  );
}
