import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { TeamAchievement } from "@/models";
import { serialize } from "@/lib/serialize";
import type { AchievementType, AchievementStatus } from "@/types/db";

export interface AchievementRecord {
  id: string;
  teamId: string;
  type: AchievementType;
  status: AchievementStatus;
  coinReward: number;
  createdAt: string;
}

/**
 * Achievements for the host console: everything still SUGGESTED (awaiting the
 * host) plus a short tail of recently AWARDED ones for context.
 */
export async function getAchievementsByRoom(roomId: string): Promise<AchievementRecord[]> {
  await connectToDatabase();
  const rows = await TeamAchievement.find({
    roomId,
    status: { $in: ["SUGGESTED", "AWARDED"] },
  })
    .sort({ status: 1, createdAt: -1 })
    .limit(30)
    .lean();

  return rows.map((row) =>
    serialize<AchievementRecord>({
      id: row._id.toString(),
      teamId: row.teamId.toString(),
      type: row.type,
      status: row.status,
      coinReward: row.coinReward,
      createdAt: row.createdAt,
    })
  );
}
