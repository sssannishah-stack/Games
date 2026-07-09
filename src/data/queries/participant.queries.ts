import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Participant } from "@/models";
import { serialize } from "@/lib/serialize";
import { isDeviceConnected } from "@/lib/teamRoles";
import type { ParticipantRole } from "@/types/db";

export interface ParticipantRecord {
  id: string;
  name: string;
  teamId: string;
  role: ParticipantRole;
  connected: boolean;
}

/** Everyone who has actually joined this room live (distinct from a team's host-authored member roster). */
export async function getParticipantsByRoom(roomId: string): Promise<ParticipantRecord[]> {
  await connectToDatabase();
  const participants = await Participant.find({ roomId }).sort({ joinedAt: 1 }).lean();
  const now = Date.now();
  return participants.map((p) =>
    serialize<ParticipantRecord>({
      id: p._id.toString(),
      name: p.name,
      teamId: p.teamId.toString(),
      role: p.role ?? "MEMBER",
      connected: isDeviceConnected(p.lastSeenAt, now),
    })
  );
}
