"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SceneStage } from "@/components/scene/SceneStage";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { ReconstructedState } from "./reconstructState";

/**
 * Recreates what participants saw at the replay cursor — reuses the exact
 * same SceneStage renderer as the Event Flow builder's live preview, just
 * fed a reconstructed historical snapshot instead of the room's current
 * state. Store/Auction status render as an overlay since they're independent
 * room-level state, not scene types (see plan notes).
 */
export function LiveReplayPanel({
  state,
  room,
  teams,
  rounds,
  questions,
  cards,
}: {
  state: ReconstructedState;
  room: RoomDetail;
  teams: TeamRecord[];
  rounds: RoundRecord[];
  questions: QuestionRecord[];
  cards: PowerCardRecord[];
}) {
  const scene = state.currentScene;
  const question = scene?.questionId ? questions.find((q) => q.id === scene.questionId) ?? null : null;
  const round = scene?.roundId ? rounds.find((r) => r.id === scene.roundId) ?? null : null;

  // Synthetic team snapshot — real identity (id/name/color/members), scores
  // and coins swapped for the reconstructed values at the cursor.
  const snapshotTeams: TeamRecord[] = teams.map((t) => ({
    ...t,
    score: state.teamScores.get(t.id) ?? 0,
    coins: state.teamCoins.get(t.id) ?? 0,
  }));

  const auctionCard = state.activeAuction ? cards.find((c) => c.id === state.activeAuction!.powerCardId) : null;

  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">LIVE REPLAY</span>
        <div className="flex items-center gap-1.5">
          {state.storeOpen && (
            <span className="flex items-center gap-1 rounded-full bg-warn/10 border border-warn/30 px-2 py-0.5 text-[9.5px] font-bold text-warn">
              <Icon name="store" size={11} /> STORE OPEN
            </span>
          )}
          {state.activeAuction && (
            <span className="flex items-center gap-1 rounded-full bg-accent/10 border border-accent/30 px-2 py-0.5 text-[9.5px] font-bold text-accent">
              <Icon name="gavel" size={11} /> AUCTION LIVE
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex justify-center">
        <div
          data-theme="dark"
          className="w-full max-w-[440px] rounded-2xl border border-line/[.1] bg-[linear-gradient(180deg,#0C0D13,#08090C)] p-6 flex flex-col min-h-0 relative overflow-hidden"
        >
          {scene ? (
            <span className="self-center text-[9px] font-bold tracking-[.14em] text-accent bg-accent/15 rounded-full px-3 py-1 shrink-0">
              {scene.type.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="self-center text-[9px] font-bold tracking-[.14em] text-mute-2 bg-line/[.08] rounded-full px-3 py-1 shrink-0">
              BEFORE START
            </span>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={scene?.id ?? "none"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col mt-4 min-h-0"
            >
              {scene ? (
                <SceneStage scene={scene} question={question} round={round} teams={snapshotTeams} room={room} compact={false} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-mute-2 text-[12px]">
                  Nothing has happened yet — press Play or jump to an event.
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {state.activeAuction && (
            <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-accent/30 bg-[#0C0D13]/95 backdrop-blur px-3 py-2">
              <span className="text-[9px] font-bold tracking-[.1em] text-accent">AUCTION — {auctionCard?.name ?? "Power card"}</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {state.activeAuction.bids.map((bid) => {
                  const team = teams.find((t) => t.id === bid.teamId);
                  return (
                    <span key={bid.teamId} className="text-[10.5px] text-ink-3 bg-line/[.06] rounded-full px-2 py-0.5">
                      {team?.name ?? "Team"}: {bid.amount}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
