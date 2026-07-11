import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Team } from "@/models";
import { serialize } from "@/lib/serialize";

export interface TeamRecord {
  id: string;
  roomId: string;
  name: string;
  color?: string;
  members: { name: string }[];
  score: number;
  rank: number;
  coins: number;
  /** Question ids this team is insured against negative marks on. */
  insuredQuestionIds: string[];
}

export async function getTeamsByRoom(roomId: string): Promise<TeamRecord[]> {
  await connectToDatabase();
  const teams = await Team.find({ roomId }).sort({ createdAt: 1 }).lean();
  return teams.map((t) =>
    serialize<TeamRecord>({
      id: t._id.toString(),
      roomId: t.roomId.toString(),
      name: t.name,
      color: t.color,
      members: t.members,
      score: t.score,
      rank: t.rank,
      coins: t.coins,
      insuredQuestionIds: t.insuredQuestionIds ?? [],
    })
  );
}
