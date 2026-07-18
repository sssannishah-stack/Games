"use client";

import { Icon } from "@/components/ui/Icon";

/** One round's snapshot, embedded on ROUND_OVERVIEW / ROUND_COMPLETE scenes. */
export interface RoadmapItem {
  title: string;
  questionCount: number;
  positiveMarks: number;
  negativeMarks: number;
  coinReward: number;
  specialMode: string;
}

export interface LeaderRow {
  id: string;
  name: string;
  score: number;
  color?: string | null;
  isMe?: boolean;
}

/** Safely read a roadmap array out of a scene's untyped `content`. */
export function readRoadmap(content: Record<string, unknown> | undefined): RoadmapItem[] {
  const raw = content?.roadmap;
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      title: String(o.title ?? "Round"),
      questionCount: Number(o.questionCount ?? 0),
      positiveMarks: Number(o.positiveMarks ?? 0),
      negativeMarks: Number(o.negativeMarks ?? 0),
      coinReward: Number(o.coinReward ?? 0),
      specialMode: String(o.specialMode ?? "NONE"),
    };
  });
}

const MODE_LABEL: Record<string, string> = {
  SPEED: "⚡ Speed",
  RISK: "🎲 Risk",
  SURVIVAL: "💀 Survival",
  BONUS: "★ Bonus",
};

/**
 * The full competition roadmap — every round with its question count and what
 * it's worth. Stays readable from 3 rounds to 20: rows are compact and the
 * list scrolls inside a fixed max height rather than pushing the page.
 */
export function RoundsRoadmap({
  roadmap,
  totalQuestions,
  economy = false,
  currentIndex = -1,
  className = "",
}: {
  roadmap: RoadmapItem[];
  totalQuestions?: number;
  economy?: boolean;
  /** Highlight this round as the live one (host preview / mid-event). */
  currentIndex?: number;
  className?: string;
}) {
  const total = totalQuestions ?? roadmap.reduce((s, r) => s + r.questionCount, 0);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black tracking-[.16em] text-violet-300">🗺 COMPETITION ROADMAP</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-mute-2">
          <span className="rounded-full border border-line/[.12] bg-line/[.05] px-2 py-0.5 font-bold">
            {roadmap.length} round{roadmap.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-line/[.12] bg-line/[.05] px-2 py-0.5 font-bold">
            {total} question{total === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
        {roadmap.map((r, i) => {
          const isCurrent = i === currentIndex;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                isCurrent ? "border-accent/45 bg-accent/[.08]" : "border-line/[.08] bg-line/[.03]"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[12px] font-black shrink-0 ${
                  isCurrent ? "bg-accent text-white" : "bg-line/[.06] text-ink-3"
                }`}
              >
                {i + 1}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13.5px] font-bold text-ink truncate">{r.title}</span>
                <span className="text-[10.5px] text-mute-2">
                  {r.questionCount} question{r.questionCount === 1 ? "" : "s"}
                </span>
              </div>
              {MODE_LABEL[r.specialMode] && (
                <span className="shrink-0 rounded-full border border-warn/30 bg-warn/[.08] px-2 py-0.5 text-[9.5px] font-bold text-warn">
                  {MODE_LABEL[r.specialMode]}
                </span>
              )}
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold">
                <span className="text-success">+{r.positiveMarks}</span>
                {r.negativeMarks > 0 && <span className="text-danger-soft">−{Math.abs(r.negativeMarks)}</span>}
                {economy && r.coinReward > 0 && <span className="text-warn">{r.coinReward}🪙</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * End-of-round page: how far through the competition we are, which rounds are
 * done vs left, and the current standings. `roundIndex` is the 0-based index of
 * the round that just finished.
 */
export function RoundProgress({
  roadmap,
  roundIndex,
  leaderboard,
  economy = false,
  myTeamId,
  className = "",
}: {
  roadmap: RoadmapItem[];
  roundIndex: number;
  leaderboard: LeaderRow[];
  economy?: boolean;
  myTeamId?: string | null;
  className?: string;
}) {
  const total = roadmap.length;
  const done = Math.min(total, roundIndex + 1);
  const remaining = Math.max(0, total - done);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const ranked = [...leaderboard].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...ranked.map((t) => t.score));
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="text-center">
        <span className="text-[11px] font-black tracking-[.16em] text-success">✓ ROUND COMPLETE</span>
        <h1 className="mt-1 text-[26px] font-black tracking-[-.02em] text-ink leading-tight">
          Round {done} of {total} done
        </h1>
        <p className="mt-0.5 text-[12.5px] text-mute-2">
          {remaining === 0 ? "That was the final round — on to the results!" : `${remaining} round${remaining === 1 ? "" : "s"} to go.`}
        </p>
      </div>

      {/* Progress bar + per-round dots (dots scale fine up to ~20). */}
      <div className="flex flex-col gap-2">
        <div className="h-2 rounded-full bg-line/[.1] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success to-success/60 transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {roadmap.map((r, i) => {
            const state = i < done ? "done" : i === done ? "next" : "todo";
            return (
              <span
                key={i}
                title={`${i + 1}. ${r.title}`}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                  state === "done"
                    ? "border-success/35 bg-success/[.1] text-success"
                    : state === "next"
                      ? "border-accent/40 bg-accent/[.1] text-accent"
                      : "border-line/[.1] bg-line/[.03] text-mute-2"
                }`}
              >
                {state === "done" ? <Icon name="check" size={9} /> : `${i + 1}`}
                <span className="max-w-[92px] truncate">{r.title}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Standings. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-black tracking-[.14em] text-warn">🏆 STANDINGS</span>
        <div className="flex flex-col gap-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
          {ranked.map((team, i) => {
            const isMe = team.isMe || (myTeamId != null && team.id === myTeamId);
            const fill = Math.max(0, Math.min(1, team.score / maxScore));
            return (
              <div
                key={team.id}
                className={`relative overflow-hidden rounded-xl border px-3 py-2.5 flex items-center gap-3 ${
                  isMe ? "border-accent/45 bg-accent/[.1]" : i === 0 ? "border-warn/40 bg-warn/[.06]" : "border-line/[.08] bg-line/[.03]"
                }`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-r-xl"
                  style={{
                    width: `${fill * 100}%`,
                    background: `linear-gradient(90deg, color-mix(in oklab, ${team.color ?? "#6C7BFA"} 16%, transparent), transparent)`,
                  }}
                />
                <span className="relative w-7 text-center font-mono text-[14px] font-black text-ink-3 shrink-0">
                  {i < 3 ? MEDAL[i] : i + 1}
                </span>
                <span className="relative w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
                <span className="relative text-[14px] font-bold text-ink truncate flex-1">{team.name}</span>
                {economy && <span className="relative text-[11px] font-bold text-warn shrink-0">·</span>}
                <span className="relative font-mono text-[16px] font-black text-ink tabular-nums shrink-0">{team.score}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
