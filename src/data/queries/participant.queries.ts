import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Participant } from "@/models";
import { serialize } from "@/lib/serialize";

export interface ParticipantRecord {
  id: string;
  name: string;
  teamId: string;
}

/** Everyone who has actually joined this room live (distinct from a team's host-authored member roster). */
export async function getParticipantsByRoom(roomId: string): Promise<ParticipantRecord[]> {
  await connectToDatabase();
  const participants = await Participant.find({ roomId }).sort({ joinedAt: 1 }).lean();
  return participants.map((p) =>
    serialize<ParticipantRecord>({
      id: p._id.toString(),
      name: p.name,
      teamId: p.teamId.toString(),
    })
  );
}
