import type { RoundBreakdown } from "@/data/queries/analytics.queries";

export interface TeamRoundTrack {
  teamId: string;
  /** Cumulative score after each round, in round order. */
  cumulative: number[];
  /** Rank (1 = leading) after each round, in round order. */
  ranks: number[];
}

/**
 * Reconstructs each team's rank after every round from the round-breakdown
 * matrix — feeds the rank-change arrows and the round-by-round mini bars in
 * the team drawer. Ties share the same rank (dense ranking), matching how
 * the rest of the app treats a tied score.
 */
export function computeRankTimeline(breakdown: RoundBreakdown): TeamRoundTrack[] {
  const { rounds, teams, matrix } = breakdown;
  const running = new Map(teams.map((t) => [t.id, 0]));
  const tracks = new Map<string, TeamRoundTrack>(
    teams.map((t) => [t.id, { teamId: t.id, cumulative: [], ranks: [] }])
  );

  for (const round of rounds) {
    for (const team of teams) {
      const delta = matrix[round.roundId]?.[team.id] ?? 0;
      running.set(team.id, (running.get(team.id) ?? 0) + delta);
    }
    const ordered = [...running.entries()].sort((a, b) => b[1] - a[1]);
    const rankByTeam = new Map<string, number>();
    let rank = 0;
    let lastScore: number | null = null;
    ordered.forEach(([teamId, score], index) => {
      if (score !== lastScore) rank = index + 1;
      lastScore = score;
      rankByTeam.set(teamId, rank);
    });
    for (const team of teams) {
      const track = tracks.get(team.id)!;
      track.cumulative.push(running.get(team.id) ?? 0);
      track.ranks.push(rankByTeam.get(team.id) ?? teams.length);
    }
  }

  return [...tracks.values()];
}

export interface ComebackResult {
  teamId: string;
  startRank: number;
  finalRank: number;
  improvement: number;
}

/** The team with the biggest rank improvement from round 1 to the final round. */
export function computeGreatestComeback(breakdown: RoundBreakdown): ComebackResult | null {
  const tracks = computeRankTimeline(breakdown);
  if (tracks.length === 0 || tracks[0].ranks.length === 0) return null;

  let best: ComebackResult | null = null;
  for (const track of tracks) {
    const startRank = track.ranks[0];
    const finalRank = track.ranks[track.ranks.length - 1];
    const improvement = startRank - finalRank;
    if (!best || improvement > best.improvement) {
      best = { teamId: track.teamId, startRank, finalRank, improvement };
    }
  }
  return best && best.improvement > 0 ? best : null;
}
