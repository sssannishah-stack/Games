import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Scene } from "@/models";
import { serialize } from "@/lib/serialize";
import type { SceneStatus, SceneType } from "@/types/db";

export interface SceneRecord {
  id: string;
  roomId: string;
  roundId?: string | null;
  type: SceneType;
  order: number;
  title: string;
  isActive: boolean;
  status: SceneStatus;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  questionId?: string | null;
}

export async function getScenesByRoom(roomId: string): Promise<SceneRecord[]> {
  await connectToDatabase();
  const scenes = await Scene.find({ roomId }).sort({ order: 1 }).lean();
  return scenes.map((s) =>
    serialize<SceneRecord>({
      id: s._id.toString(),
      roomId: s.roomId.toString(),
      roundId: s.roundId ? s.roundId.toString() : null,
      type: s.type,
      order: s.order,
      title: s.title ?? s.type.replace(/_/g, " "),
      isActive: s.isActive,
      status: s.status ?? (s.isActive ? "LIVE" : "UPCOMING"),
      content: s.content,
      settings: s.settings ?? {},
      questionId: s.questionId ? s.questionId.toString() : null,
    })
  );
}
