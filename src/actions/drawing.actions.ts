"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { DrawingStroke, Room, Scene } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import { assertTeamController } from "@/lib/teamRoles";
import type { IRoom, IScene } from "@/types/db";

/** Cap a single stroke so one payload can't balloon the collection. */
const MAX_POINTS_PER_STROKE = 2000;

/**
 * Confirm the caller is allowed to draw on the room's live board, and that a
 * DRAWING scene is actually live. Two callers are legitimate:
 *   • the host (session owner of the room), who can always draw; or
 *   • the captain of the team the host has assigned as drawer.
 * Returns the live room + the questionId the board is currently scoped to.
 */
async function assertCanDraw(
  roomId: string,
  actor: { teamId?: string | null; participantId?: string | null }
): Promise<{ roomId: string; questionId: string }> {
  const room = await Room.findById(roomId).lean<IRoom>();
  if (!room) throw new Error("Room not found.");

  const scene = room.currentSceneId
    ? await Scene.findById(room.currentSceneId).select("type").lean<IScene>()
    : null;
  if (scene?.type !== "DRAWING") throw new Error("The board is only open during a drawing round.");
  if (!room.currentQuestionId) throw new Error("No drawing question is live.");

  if (actor.participantId) {
    // Participant drawer path — must be the assigned team's controlling captain.
    if (!actor.teamId) throw new Error("Only the captain can do this.");
    const drawerTeamId = room.liveState?.drawerTeamId?.toString() ?? null;
    if (drawerTeamId !== actor.teamId) throw new Error("Your team isn't the drawer right now.");
    await assertTeamController(actor.teamId, actor.participantId);
  } else {
    // Host path — session owner of the room.
    const user = await requireUser();
    await assertRoomOwnership(roomId, user.id);
  }

  return { roomId, questionId: room.currentQuestionId.toString() };
}

async function nextSeq(roomId: string, questionId: string): Promise<number> {
  const last = await DrawingStroke.findOne({ roomId, questionId })
    .sort({ seq: -1 })
    .select("seq")
    .lean<{ seq: number }>();
  return (last?.seq ?? 0) + 1;
}

export interface AppendStrokeInput {
  roomId: string;
  /** Present only for a participant drawer; omit for the host. */
  teamId?: string | null;
  participantId?: string | null;
  color: string;
  width: number;
  erase: boolean;
  /** Flat, normalized: [x0, y0, x1, y1, …]. */
  points: number[];
}

/** Add one finished stroke to the live board. */
export async function appendStroke(input: AppendStrokeInput): Promise<{ seq: number }> {
  await connectToDatabase();
  const { roomId, questionId } = await assertCanDraw(input.roomId, input);

  if (!Array.isArray(input.points) || input.points.length < 2 || input.points.length % 2 !== 0) {
    throw new Error("A stroke needs at least one point.");
  }
  // Round to 4 decimals to keep the ledger compact; clamp to the canvas box.
  const points = input.points
    .slice(0, MAX_POINTS_PER_STROKE * 2)
    .map((n) => Math.round(Math.min(1, Math.max(0, n)) * 1e4) / 1e4);

  const seq = await nextSeq(roomId, questionId);
  await DrawingStroke.create({
    roomId,
    questionId,
    seq,
    kind: "STROKE",
    color: input.color,
    width: Math.min(48, Math.max(1, input.width)),
    erase: Boolean(input.erase),
    points,
  });
  return { seq };
}

/** Wipe the board — recorded as a CLEAR marker, not a delete. */
export async function clearBoard(input: {
  roomId: string;
  teamId?: string | null;
  participantId?: string | null;
}): Promise<{ seq: number }> {
  await connectToDatabase();
  const { roomId, questionId } = await assertCanDraw(input.roomId, input);
  const seq = await nextSeq(roomId, questionId);
  await DrawingStroke.create({ roomId, questionId, seq, kind: "CLEAR", points: [] });
  return { seq };
}

/**
 * Host-only: hand the pen to a team (its captain draws) or take it back
 * (`teamId: null` → host-only). Clears the board so the new drawer starts
 * fresh, matching the "new drawer, blank canvas" expectation.
 */
export async function setDrawer(roomId: string, teamId: string | null): Promise<void> {
  await connectToDatabase();
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);

  await Room.findByIdAndUpdate(roomId, { $set: { "liveState.drawerTeamId": teamId } });

  const room = await Room.findById(roomId).select("currentQuestionId").lean<IRoom>();
  if (room?.currentQuestionId) {
    const seq = await nextSeq(roomId, room.currentQuestionId.toString());
    await DrawingStroke.create({
      roomId,
      questionId: room.currentQuestionId,
      seq,
      kind: "CLEAR",
      points: [],
    });
  }
  revalidatePath(`/host/${roomId}`);
}
