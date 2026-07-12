import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/database/mongodb";
import { DrawingStroke, Room, Scene } from "@/models";
import { serialize } from "@/lib/serialize";
import type { IDrawingStroke, IRoom, IScene } from "@/types/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight polling channel for the live drawing board, kept off the main
 * ~2s live payload so stroke geometry never bloats every participant's poll.
 * The board asks "everything after seq N for the current drawing question";
 * a `CLEAR` row in the batch tells the client to wipe and keep going.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await context.params;
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0) || 0;

  await connectToDatabase();

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() })
    .select("currentSceneId currentQuestionId")
    .lean<IRoom>();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const scene = room.currentSceneId
    ? await Scene.findById(room.currentSceneId).select("type").lean<IScene>()
    : null;

  // Off a drawing scene there's nothing to draw — hand back an empty, stable
  // response so the client parks its poll without erroring.
  if (scene?.type !== "DRAWING" || !room.currentQuestionId) {
    return NextResponse.json({ active: false, questionId: null, strokes: [], revision: 0 });
  }

  const questionId = room.currentQuestionId.toString();
  const strokes = await DrawingStroke.find({ roomId: room._id, questionId, seq: { $gt: since } })
    .sort({ seq: 1 })
    .lean<IDrawingStroke[]>();

  return NextResponse.json(
    serialize({
      active: true,
      questionId,
      strokes: strokes.map((s) => ({
        seq: s.seq,
        kind: s.kind,
        color: s.color,
        width: s.width,
        erase: s.erase,
        points: s.points,
      })),
      revision: strokes.length ? strokes[strokes.length - 1].seq : since,
    })
  );
}
