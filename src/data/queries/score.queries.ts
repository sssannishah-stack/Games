import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { ScoreTransaction, Team } from "@/models";
import { serialize } from "@/lib/serialize";
import type { ScoreReason } from "@/types/db";

export interface ScoreTransactionRecord {
  id: string;
  roomId: string;
  teamId: string;
  teamName: string;
  questionId: string | null;
  participantId: string | null;
  points: number;
  reason: ScoreReason;
  isUndo: boolean;
  isReverted: boolean;
  createdAt: string;
}

export async function getScoreHistoryByRoom(roomId: string): Promise<ScoreTransactionRecord[]> {
  await connectToDatabase();
  const transactions = await ScoreTransaction.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
  if (transactions.length === 0) return [];

  const teamIds = [...new Set(transactions.map((item) => item.teamId.toString()))];
  const teams = await Team.find({ _id: { $in: teamIds } }).select("name").lean();
  const teamMap = new Map(teams.map((team) => [team._id.toString(), team.name]));

  return transactions.map((item) =>
    serialize<ScoreTransactionRecord>({
      id: item._id.toString(),
      roomId: item.roomId.toString(),
      teamId: item.teamId.toString(),
      teamName: teamMap.get(item.teamId.toString()) ?? "Team",
      questionId: item.questionId ? item.questionId.toString() : null,
      participantId: item.participantId ? item.participantId.toString() : null,
      points: item.points,
      reason: item.reason,
      isUndo: item.isUndo ?? false,
      isReverted: item.isReverted ?? false,
      createdAt: item.createdAt,
    })
  );
}
