"use client";

import { Card } from "@/components/ui/Card";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { ReplayData } from "./reconstructState";

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-line/[.03] border border-line/[.07] px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold tracking-[.08em] text-mute-2">{label.toUpperCase()}</span>
      <span className="text-[16px] font-black text-ink tabular-nums">{value}</span>
    </div>
  );
}

export function ReplaySummary({
  data,
  rounds,
  cards,
}: {
  data: ReplayData;
  rounds: RoundRecord[];
  cards: PowerCardRecord[];
}) {
  const { events, scoreHistory, coinHistory, auctions, scenes } = data;
  if (events.length === 0) return null;

  const durationMs = new Date(events[events.length - 1].createdAt).getTime() - new Date(events[0].createdAt).getTime();
  const questionsPlayed = new Set(scenes.filter((s) => (s.type === "QUESTION" || s.type === "DRAWING") && s.questionId).map((s) => s.questionId)).size;
  const hintCardIds = new Set(cards.filter((c) => c.effectType === "HINT").map((c) => c.id));
  let powerCardsUsed = 0;
  let hintsUsed = 0;
  for (const event of events) {
    if (event.type !== "POWER_CARD_USED") continue;
    powerCardsUsed += 1;
    if (event.metadata.powerCardId && hintCardIds.has(String(event.metadata.powerCardId))) hintsUsed += 1;
  }
  const storePurchases = events.filter((e) => e.type === "CARD_PURCHASED").length;
  const coinsSpent = coinHistory.filter((c) => c.amount < 0).reduce((sum, c) => sum + Math.abs(c.amount), 0);

  // Highest streak — walk score history per team, tracking consecutive CORRECTs.
  const streaks = new Map<string, number>();
  let highestStreak = 0;
  for (const tx of scoreHistory) {
    if (tx.isReverted) continue;
    if (tx.reason === "CORRECT") {
      const next = (streaks.get(tx.teamId) ?? 0) + 1;
      streaks.set(tx.teamId, next);
      highestStreak = Math.max(highestStreak, next);
    } else if (tx.reason === "WRONG") {
      streaks.set(tx.teamId, 0);
    }
  }

  // Fastest round — gap between consecutive ROUND_INTRO scene changes (or the
  // last event, for the final round).
  const introTimes = rounds
    .map((round) => {
      const scene = scenes.find((s) => s.roundId === round.id && s.type === "ROUND_INTRO");
      const event = scene ? events.find((e) => e.type === "SCENE_CHANGED" && String(e.metadata.sceneId) === scene.id) : null;
      return event ? new Date(event.createdAt).getTime() : null;
    })
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  let fastestRoundMs: number | null = null;
  for (let i = 0; i < introTimes.length; i++) {
    const end = introTimes[i + 1] ?? new Date(events[events.length - 1].createdAt).getTime();
    const span = end - introTimes[i];
    if (span > 0 && (fastestRoundMs === null || span < fastestRoundMs)) fastestRoundMs = span;
  }

  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-3">
      <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">REPLAY SUMMARY</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat label="Duration" value={fmtDuration(durationMs)} />
        <Stat label="Questions Played" value={questionsPlayed} />
        <Stat label="Power Cards Used" value={powerCardsUsed} />
        <Stat label="Coins Spent" value={coinsSpent} />
        <Stat label="Store Purchases" value={storePurchases} />
        <Stat label="Auctions" value={auctions.length} />
        <Stat label="Hints Used" value={hintsUsed} />
        <Stat label="Highest Streak" value={highestStreak} />
        {fastestRoundMs !== null && <Stat label="Fastest Round" value={fmtDuration(fastestRoundMs)} />}
      </div>
    </Card>
  );
}
