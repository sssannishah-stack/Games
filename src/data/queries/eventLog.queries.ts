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
  // 50 was tight once per-team answer/power-card events started landing here:
  // a busy question could push a team's submitted answer out of the window
  // before the host had judged it. The feed itself still renders only the
  // newest 16 — this larger window is what the per-question panels filter on.
  const logs = await EventLog.find({ roomId }).sort({ createdAt: -1 }).limit(150).lean();
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
