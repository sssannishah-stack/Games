"use client";

import { Card } from "@/components/ui/Card";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { ReconstructedState } from "./reconstructState";

export function StatePanel({
  state,
  teams,
  cards,
  rounds,
  questions,
}: {
  state: ReconstructedState;
  teams: TeamRecord[];
  cards: PowerCardRecord[];
  rounds: RoundRecord[];
  questions: QuestionRecord[];
}) {
  const scene = state.currentScene;
  const round = scene?.roundId ? rounds.find((r) => r.id === scene.roundId) : null;
  const question = scene?.questionId ? questions.find((q) => q.id === scene.questionId) : null;
  const cardNameById = new Map(cards.map((c) => [c.id, c.name]));

  const ranked = [...teams]
    .map((t) => ({ ...t, replayScore: state.teamScores.get(t.id) ?? 0 }))
    .sort((a, b) => b.replayScore - a.replayScore);

  return (
    <Card className="rounded-2xl p-3.5 flex flex-col gap-3 h-full min-h-0 overflow-y-auto encore-scrollbar">
      <div>
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">REPLAY STATE</span>
        <div className="mt-1.5 flex flex-col gap-0.5">
          <span className="text-[12px] font-bold text-ink">{round?.title ?? "—"}</span>
          <span className="text-[11px] text-mute-2 truncate">{question?.question ?? "No question live"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10.5px]">
        <span className={`rounded-full px-2 py-0.5 border font-bold ${state.storeOpen ? "text-warn border-warn/30 bg-warn/[.08]" : "text-mute-2 border-line/[.1] bg-line/[.03]"}`}>
          Store {state.storeOpen ? "Open" : "Closed"}
        </span>
        <span className={`rounded-full px-2 py-0.5 border font-bold ${state.activeAuction ? "text-accent border-accent/30 bg-accent/[.08]" : "text-mute-2 border-line/[.1] bg-line/[.03]"}`}>
          Auction {state.activeAuction ? "Live" : "Idle"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-[.08em] text-mute-2">LIVE RANKINGS</span>
        {ranked.map((team, i) => {
          const ownedCards = state.teamPowerCards.get(team.id);
          const cardCount = ownedCards ? [...ownedCards.values()].reduce((a, b) => a + b, 0) : 0;
          return (
            <div key={team.id} className="flex items-center gap-2 rounded-lg border border-line/[.07] bg-line/[.03] px-2.5 py-1.5">
              <span className="text-[10.5px] font-black text-mute-2 w-4">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
              <span className="text-[11.5px] font-semibold text-ink truncate flex-1">{team.name}</span>
              <span className="text-[10px] text-warn tabular-nums">{state.teamCoins.get(team.id) ?? 0}c</span>
              <span className="text-[10px] text-accent tabular-nums">{cardCount} 🃏</span>
              <span className="text-[12px] font-black text-ink tabular-nums">{team.replayScore}</span>
            </div>
          );
        })}
      </div>

      {ranked.some((t) => (state.teamPowerCards.get(t.id)?.size ?? 0) > 0) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-[.08em] text-mute-2">POWER CARDS OWNED</span>
          {ranked.map((team) => {
            const owned = state.teamPowerCards.get(team.id);
            if (!owned || owned.size === 0) return null;
            return (
              <div key={team.id} className="text-[10.5px] text-ink-3">
                <b>{team.name}:</b>{" "}
                {[...owned.entries()]
                  .filter(([, count]) => count > 0)
                  .map(([cardId, count]) => `${cardNameById.get(cardId) ?? "Card"}${count > 1 ? ` x${count}` : ""}`)
                  .join(", ") || "—"}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
