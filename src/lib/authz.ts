import "server-only";
import { Competition, Room, Round, Question, PowerCard } from "@/models";

/**
 * Ownership guards used by every mutating server action. Each throws when
 * the resource doesn't exist or doesn't (transitively) belong to the
 * requesting host — defense in depth alongside the page-level requireUser().
 */

export async function assertCompetitionOwnership(competitionId: string, ownerId: string) {
  const competition = await Competition.findOne({ _id: competitionId, ownerId }).lean();
  if (!competition) throw new Error("Competition not found or not owned by you.");
  return competition;
}

export async function assertRoomOwnership(roomId: string, ownerId: string) {
  const room = await Room.findById(roomId).lean();
  if (!room) throw new Error("Room not found.");
  await assertCompetitionOwnership(room.competitionId.toString(), ownerId);
  return room;
}

/** Rounds are a flat, owner-scoped library resource — not nested under a room. */
export async function assertRoundOwnership(roundId: string, ownerId: string) {
  const round = await Round.findOne({ _id: roundId, ownerId }).lean();
  if (!round) throw new Error("Round not found or not owned by you.");
  return round;
}

/** Questions are a flat, owner-scoped library resource — not nested under a round. */
export async function assertQuestionOwnership(questionId: string, ownerId: string) {
  const question = await Question.findOne({ _id: questionId, ownerId }).lean();
  if (!question) throw new Error("Question not found or not owned by you.");
  return question;
}

/** The Power Card catalog is global per host, not scoped to a competition. */
export async function assertPowerCardOwnership(powerCardId: string, ownerId: string) {
  const card = await PowerCard.findOne({ _id: powerCardId, ownerId }).lean();
  if (!card) throw new Error("Power card not found or not owned by you.");
  return card;
}
