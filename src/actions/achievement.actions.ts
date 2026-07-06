"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { TeamAchievement, EventLog } from "@/models";
import { createCoinTransaction } from "@/actions/coin.actions";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { AchievementType, ITeamAchievement } from "@/types/db";

/** Grant a suggested achievement: pay the coin reward and log it for everyone. */
async function grantReward(
  roomId: string,
  teamId: string,
  type: AchievementType,
  coinReward: number,
  userId: string
) {
  const def = ACHIEVEMENTS[type];
  if (coinReward > 0) {
    await createCoinTransaction({
      roomId,
      teamId,
      amount: coinReward,
      type: "HOST_ADJUSTMENT",
      reason: `${def.label} ${def.emoji}`,
      createdBy: userId,
    });
  }
  await EventLog.create({
    roomId,
    type: "ACHIEVEMENT_EARNED",
    metadata: { teamId, achievementType: type, label: def.label, emoji: def.emoji, coinReward },
  });
}

/** Host approves a suggested achievement — grants the reward and marks it awarded. */
export async function awardAchievement(achievementId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();

  const achievement = await TeamAchievement.findById(achievementId).lean<ITeamAchievement>();
  if (!achievement) throw new Error("Achievement not found.");
  await assertRoomOwnership(achievement.roomId.toString(), user.id);
  if (achievement.status !== "SUGGESTED") return;

  await TeamAchievement.findByIdAndUpdate(achievementId, {
    $set: { status: "AWARDED", awardedBy: user.id },
  });
  await grantReward(
    achievement.roomId.toString(),
    achievement.teamId.toString(),
    achievement.type,
    achievement.coinReward,
    user.id
  );

  revalidatePath(`/host/${achievement.roomId.toString()}`);
}

/** Host declines a suggested achievement — no reward, and it won't be re-offered. */
export async function dismissAchievement(achievementId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();

  const achievement = await TeamAchievement.findById(achievementId).lean<ITeamAchievement>();
  if (!achievement) throw new Error("Achievement not found.");
  await assertRoomOwnership(achievement.roomId.toString(), user.id);
  if (achievement.status !== "SUGGESTED") return;

  await TeamAchievement.findByIdAndUpdate(achievementId, { $set: { status: "DISMISSED" } });
  revalidatePath(`/host/${achievement.roomId.toString()}`);
}

/**
 * Host hands out an achievement the system can't auto-detect (Fast Answer,
 * Perfect Round). Created already AWARDED, with its reward granted immediately.
 */
export async function giveManualAchievement(
  roomId: string,
  teamId: string,
  type: AchievementType
): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const def = ACHIEVEMENTS[type];
  await TeamAchievement.create({
    roomId,
    teamId,
    type,
    status: "AWARDED",
    coinReward: def.coinReward,
    awardedBy: user.id,
  });
  await grantReward(roomId, teamId, type, def.coinReward, user.id);

  revalidatePath(`/host/${roomId}`);
}
