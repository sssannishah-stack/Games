import type { ReplayEvent, ReplayScoreEntry } from "@/data/queries/replay.queries";
import type { ReplayData } from "./reconstructState";

export interface ReplayMoment {
  id: string;
  emoji: string;
  label: string;
  eventIndex: number;
}

interface TeamMeta {
  id: string;
  name: string;
}

function findEventIndexAtOrAfter(events: ReplayEvent[], isoTime: string): number {
  const t = new Date(isoTime).getTime();
  const idx = events.findIndex((e) => new Date(e.createdAt).getTime() >= t);
  return idx === -1 ? Math.max(0, events.length - 1) : idx;
}

/**
 * Auto-detected "shareable moments" — jump shortcuts computed fresh from the
 * already-fetched replay data every time the page loads. Not host-authored
 * bookmarks, nothing persisted (confirmed scope with the user).
 */
export function detectMoments(data: ReplayData, teams: TeamMeta[]): ReplayMoment[] {
  const moments: ReplayMoment[] = [];
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const lastIndex = Math.max(0, data.events.length - 1);

  // --- Biggest Comeback & Highest Score: walk score history, tracking each
  // team's best (lowest-numbered) and worst (highest-numbered) rank reached. ---
  const running = new Map(teams.map((t) => [t.id, 0]));
  const worstRank = new Map(teams.map((t) => [t.id, 1]));
  for (const tx of data.scoreHistory) {
    if (tx.isReverted) continue;
    running.set(tx.teamId, (running.get(tx.teamId) ?? 0) + tx.points);
    const ordered = [...running.entries()].sort((a, b) => b[1] - a[1]);
    ordered.forEach(([teamId], index) => {
      const rank = index + 1;
      if (rank > (worstRank.get(teamId) ?? 1)) worstRank.set(teamId, rank);
    });
  }
  const finalOrdered = [...running.entries()].sort((a, b) => b[1] - a[1]);
  const finalRankByTeam = new Map(finalOrdered.map(([teamId], i) => [teamId, i + 1]));

  let bestComeback: { teamId: string; improvement: number } | null = null;
  for (const [teamId, worst] of worstRank.entries()) {
    const final = finalRankByTeam.get(teamId) ?? worst;
    const improvement = worst - final;
    if (improvement > 0 && (!bestComeback || improvement > bestComeback.improvement)) {
      bestComeback = { teamId, improvement };
    }
  }
  if (bestComeback) {
    moments.push({
      id: "comeback",
      emoji: "🏆",
      label: `Biggest Comeback — ${teamNameById.get(bestComeback.teamId) ?? "A team"}`,
      eventIndex: lastIndex,
    });
  }

  if (finalOrdered.length > 0 && finalOrdered[0][1] > 0) {
    moments.push({
      id: "highest-score",
      emoji: "⚡",
      label: `Highest Score — ${teamNameById.get(finalOrdered[0][0]) ?? "A team"} (${finalOrdered[0][1]})`,
      eventIndex: lastIndex,
    });
  }

  // --- Mystery Box Win: REWARD_DROP events sourced from a Mystery card. ---
  data.events.forEach((event, index) => {
    if (event.type === "REWARD_DROP" && event.metadata.source === "MYSTERY") {
      const teamId = event.metadata.teamId ? String(event.metadata.teamId) : null;
      moments.push({
        id: `mystery-${event.id}`,
        emoji: "🎁",
        label: `Mystery Box — ${teamId ? teamNameById.get(teamId) ?? "A team" : "A team"}`,
        eventIndex: index,
      });
    }
  });

  // --- Perfect Round: a team with zero WRONG transactions in a round they
  // actually played (at least one CORRECT/WRONG transaction in it). ---
  const questionToRound = new Map<string, string | null>();
  for (const scene of data.scenes) {
    if (scene.questionId) questionToRound.set(scene.questionId, scene.roundId ?? null);
  }
  const roundTeamTx = new Map<string, ReplayScoreEntry[]>();
  for (const tx of data.scoreHistory) {
    if (tx.isReverted || !tx.questionId) continue;
    const roundId = questionToRound.get(tx.questionId);
    if (!roundId) continue;
    const key = `${roundId}:${tx.teamId}`;
    const list = roundTeamTx.get(key) ?? [];
    list.push(tx);
    roundTeamTx.set(key, list);
  }
  for (const [key, txs] of roundTeamTx.entries()) {
    const [roundId, teamId] = key.split(":");
    const hasWrong = txs.some((t) => t.reason === "WRONG");
    const hasCorrect = txs.some((t) => t.reason === "CORRECT");
    if (hasCorrect && !hasWrong) {
      const lastTx = txs[txs.length - 1];
      moments.push({
        id: `perfect-${roundId}-${teamId}`,
        emoji: "🔥",
        label: `Perfect Round — ${teamNameById.get(teamId) ?? "A team"}`,
        eventIndex: findEventIndexAtOrAfter(data.events, lastTx.createdAt),
      });
    }
  }

  return moments;
}
