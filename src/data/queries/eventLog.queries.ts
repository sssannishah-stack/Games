import "server-only";
import { EventLog } from "@/models";
import { connectToDatabase } from "@/lib/database/mongodb";
import { serialize } from "@/lib/serialize";
import type { EventLogType } from "@/types/db";

export interface EventLogRecord {
  id: string;
  roomId: string;
  type: EventLogType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getEventLogsByRoom(roomId: string): Promise<EventLogRecord[]> {
  await connectToDatabase();
  const logs = await EventLog.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
  return logs.map((log) =>
    serialize<EventLogRecord>({
      id: log._id.toString(),
      roomId: log.roomId.toString(),
      type: log.type,
      metadata: log.metadata,
      createdAt: log.createdAt,
    })
  );
}
