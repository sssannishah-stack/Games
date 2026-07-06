import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Room, Round } from "@/models";
import { serialize } from "@/lib/serialize";
import type {
  PowerCardOverrideMode,
  QuestionAssignmentMode,
  RoundType,
  RuleOverrideMode,
  SpecialRoundMode,
} from "@/types/db";

export async function countRoundsByOwner(ownerId: string): Promise<number> {
  await connectToDatabase();
  return Round.countDocuments({ ownerId });
}

export interface RoundRecord {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  rules?: string;
  category: string;
  roundType: RoundType;
  specialMode: SpecialRoundMode;
  scoringMode: RuleOverrideMode;
  defaultTimer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  questionAssignment: QuestionAssignmentMode;
  powerCardMode: PowerCardOverrideMode;
  allowedPowerCards: string[];
  questionIds: string[];
  questionCount: number;
}

function toRoundRecord(r: {
  _id: unknown;
  ownerId: unknown;
  title: string;
  description?: string;
  rules?: string;
  category?: string;
  roundType: RoundType;
  specialMode?: SpecialRoundMode;
  scoringMode: RuleOverrideMode;
  defaultTimer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  questionAssignment: QuestionAssignmentMode;
  powerCardMode: PowerCardOverrideMode;
  allowedPowerCards: string[];
  questions: unknown[];
}): RoundRecord {
  return serialize<RoundRecord>({
    id: (r._id as { toString(): string }).toString(),
    ownerId: (r.ownerId as { toString(): string }).toString(),
    title: r.title,
    description: r.description,
    rules: r.rules,
    category: r.category ?? "Custom",
    roundType: r.roundType,
    specialMode: r.specialMode ?? "NONE",
    scoringMode: r.scoringMode,
    defaultTimer: r.defaultTimer,
    positiveMarks: r.positiveMarks,
    negativeMarks: r.negativeMarks,
    bonusMarks: r.bonusMarks,
    coinReward: r.coinReward,
    questionAssignment: r.questionAssignment,
    powerCardMode: r.powerCardMode,
    allowedPowerCards: r.allowedPowerCards,
    questionIds: r.questions.map((id) => (id as { toString(): string }).toString()),
    questionCount: r.questions.length,
  });
}

/** The host's full round library. */
export async function getRoundsByOwner(ownerId: string): Promise<RoundRecord[]> {
  await connectToDatabase();
  const rounds = await Round.find({ ownerId }).sort({ updatedAt: -1 }).lean();
  return rounds.map(toRoundRecord);
}

/** A round, verified to belong to the requesting host. */
export async function getRoundById(roundId: string, ownerId: string): Promise<RoundRecord | null> {
  await connectToDatabase();
  const round = await Round.findOne({ _id: roundId, ownerId }).lean();
  if (!round) return null;
  return toRoundRecord(round);
}

/** Rounds (in the host's library) that already contain the given question — powers the "attach to round" checklist. */
export async function getRoundsContainingQuestion(
  questionId: string,
  ownerId: string
): Promise<string[]> {
  await connectToDatabase();
  const rounds = await Round.find({ ownerId, questions: questionId }).select("_id").lean();
  return rounds.map((r) => r._id.toString());
}

/** Every question id attached to at least one of the host's rounds — powers the Question Bank's Used/Unused filter. */
export async function getUsedQuestionIdSet(ownerId: string): Promise<Set<string>> {
  await connectToDatabase();
  const rounds = await Round.find({ ownerId }).select("questions").lean();
  const ids = new Set<string>();
  for (const round of rounds) {
    for (const questionId of round.questions) ids.add(questionId.toString());
  }
  return ids;
}

export async function countRoomsUsingRound(roundId: string): Promise<number> {
  await connectToDatabase();
  return Room.countDocuments({ selectedRounds: roundId });
}

/**
 * Resolves a room's `selectedRounds` id list into full `RoundRecord`s,
 * re-sorted into that array's order (Mongo's `$in` does not preserve it).
 */
export async function getSelectedRoundsForRoom(selectedRounds: string[]): Promise<RoundRecord[]> {
  if (selectedRounds.length === 0) return [];
  await connectToDatabase();
  const rounds = await Round.find({ _id: { $in: selectedRounds } }).lean();
  const byId = new Map(rounds.map((r) => [r._id.toString(), r]));
  return selectedRounds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map(toRoundRecord);
}
