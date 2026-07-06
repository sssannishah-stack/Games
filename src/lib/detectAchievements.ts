import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Team, ScoreTransaction, TeamAchievement } from "@/models";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { AchievementType } from "@/types/db";

/**
 * Suggest an achievement to the host if this team hasn't already earned (or
 * been offered) it. Idempotent: an existing SUGGESTED/AWARDED/DISMISSED row of
 * the same type blocks a re-suggestion, so the host is never nagged twice.
 */
async function suggest(roomId: string, teamId: string, type: AchievementType) {
  await TeamAchievement.updateOne(
    { roomId, teamId, type },
    { $setOnInsert: { status: "SUGGESTED", coinReward: ACHIEVEMENTS[type].coinReward } },
    { upsert: true }
  );
}

/**
 * Detect newly-earned auto achievements from the score ledger and current team
 * standings, and file them as host suggestions. Runs after each scored answer
 * (ranks + streaks are already recalculated by then). Never grants a reward —
 * that's the host's call (rule: automation suggests, host decides).
 */
export async function detectAchievements(roomId: string): Promise<void> {
  await connectToDatabase();

  const teams = await Team.find({ roomId })
    .select("_id stats.streak rank previousRank")
    .lean<{ _id: unknown; stats?: { streak?: number }; rank: number; previousRank: number }[]>();
  if (teams.length === 0) return;

  // FIRST BLOOD — the team behind the event's earliest correct answer.
  const alreadyHasFirstBlood = await TeamAchievement.exists({ roomId, type: "FIRST_BLOOD" });
  if (!alreadyHasFirstBlood) {
    const firstCorrect = await ScoreTransaction.findOne({
      roomId,
      reason: "CORRECT",
      isUndo: { $ne: true },
      isReverted: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .select("teamId")
      .lean<{ teamId: unknown } | null>();
    if (firstCorrect) {
      await suggest(roomId, String(firstCorrect.teamId), "FIRST_BLOOD");
    }
  }

  for (const team of teams) {
    const teamId = String(team._id);
    const streak = team.stats?.streak ?? 0;
    if (streak >= 5) await suggest(roomId, teamId, "ON_FIRE");
    if (streak >= 3) await suggest(roomId, teamId, "HOT_STREAK");

    // COMEBACK KING — climbed from dead last to first (needs a real field).
    if (teams.length >= 3 && team.rank === 1 && team.previousRank === teams.length) {
      await suggest(roomId, teamId, "COMEBACK_KING");
    }
  }
}
