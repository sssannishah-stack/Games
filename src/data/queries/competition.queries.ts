import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Competition, Room } from "@/models";
import { serialize } from "@/lib/serialize";
import type { CompetitionSettings, CompetitionStatus } from "@/types/db";

export interface CompetitionRecord {
  id: string;
  title: string;
  description?: string;
  language: string;
  theme: string;
  status: CompetitionStatus;
  ownerId: string;
  settings: CompetitionSettings;
  createdAt: string;
  updatedAt: string;
  roomCount: number;
}

/** All competitions owned by a host, most recent first, with room counts. */
export async function getCompetitionsByOwner(ownerId: string): Promise<CompetitionRecord[]> {
  await connectToDatabase();

  const competitions = await Competition.find({ ownerId })
    .sort({ createdAt: -1 })
    .lean();

  if (competitions.length === 0) return [];

  const roomCounts = await Room.aggregate<{ _id: string; count: number }>([
    { $match: { competitionId: { $in: competitions.map((c) => c._id) } } },
    { $group: { _id: "$competitionId", count: { $sum: 1 } } },
  ]);
  const countByCompetition = new Map(roomCounts.map((r) => [r._id.toString(), r.count]));

  return competitions.map((c) =>
    serialize<CompetitionRecord>({
      id: c._id.toString(),
      title: c.title,
      description: c.description,
      language: c.language,
      theme: c.theme,
      status: c.status,
      ownerId: c.ownerId.toString(),
      settings: c.settings,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      roomCount: countByCompetition.get(c._id.toString()) ?? 0,
    })
  );
}

export async function countCompetitionsByOwner(ownerId: string): Promise<number> {
  await connectToDatabase();
  return Competition.countDocuments({ ownerId });
}

/** A single competition, scoped to its owner (returns null if not found/owned). */
export async function getCompetitionById(
  competitionId: string,
  ownerId: string
): Promise<CompetitionRecord | null> {
  await connectToDatabase();

  // Ownership check and room count are independent — only the ownership
  // result gates the return, so run them together instead of sequentially.
  const [competition, roomCount] = await Promise.all([
    Competition.findOne({ _id: competitionId, ownerId }).lean(),
    Room.countDocuments({ competitionId }),
  ]);
  if (!competition) return null;

  return serialize<CompetitionRecord>({
    id: competition._id.toString(),
    title: competition.title,
    description: competition.description,
    language: competition.language,
    theme: competition.theme,
    status: competition.status,
    ownerId: competition.ownerId.toString(),
    settings: competition.settings,
    createdAt: competition.createdAt,
    updatedAt: competition.updatedAt,
    roomCount,
  });
}
