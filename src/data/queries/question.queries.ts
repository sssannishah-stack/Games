import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Question, Round } from "@/models";
import { serialize } from "@/lib/serialize";
import { getUsedQuestionIdSet } from "@/data/queries/round.queries";
import type {
  QuestionDifficulty,
  QuestionHint,
  QuestionMedia,
  QuestionType,
  RuleOverrideMode,
} from "@/types/db";

export async function countQuestionsByOwner(ownerId: string): Promise<number> {
  await connectToDatabase();
  return Question.countDocuments({ ownerId });
}

export interface QuestionRecord {
  id: string;
  ownerId: string;
  type: QuestionType;
  question: string;
  mediaUrl?: string;
  media?: QuestionMedia | null;
  isMCQ: boolean;
  options: string[];
  answer: string;
  explanation?: string;
  hints: QuestionHint[];
  hostNotes?: string;
  scoringMode: RuleOverrideMode;
  timerMode: RuleOverrideMode;
  timer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  difficulty: QuestionDifficulty;
  tags: string[];
  groupName: string | null;
}

function toQuestionRecord(q: {
  _id: unknown;
  ownerId: unknown;
  type: QuestionType;
  question: string;
  mediaUrl?: string;
  media?: QuestionMedia | null;
  isMCQ?: boolean;
  options?: string[];
  answer: string;
  explanation?: string;
  hints: QuestionHint[];
  hostNotes?: string;
  scoringMode: RuleOverrideMode;
  timerMode?: RuleOverrideMode;
  timer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  difficulty: QuestionDifficulty;
  tags?: string[];
  groupName?: string | null;
}): QuestionRecord {
  return serialize<QuestionRecord>({
    id: (q._id as { toString(): string }).toString(),
    ownerId: (q.ownerId as { toString(): string }).toString(),
    type: q.type,
    question: q.question,
    mediaUrl: q.mediaUrl,
    media: q.media ?? null,
    isMCQ: q.isMCQ ?? false,
    options: q.options ?? [],
    answer: q.answer,
    explanation: q.explanation,
    hints: q.hints,
    hostNotes: q.hostNotes,
    scoringMode: q.scoringMode,
    timerMode: q.timerMode ?? "INHERIT",
    timer: q.timer,
    positiveMarks: q.positiveMarks,
    negativeMarks: q.negativeMarks,
    bonusMarks: q.bonusMarks,
    coinReward: q.coinReward,
    difficulty: q.difficulty,
    tags: q.tags ?? [],
    groupName: q.groupName ?? null,
  });
}

export interface QuestionFilters {
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  usage?: "USED" | "UNUSED";
}

/** The host's full question library, with optional search/filter applied. */
export async function getQuestionsByOwner(
  ownerId: string,
  filters: QuestionFilters = {}
): Promise<QuestionRecord[]> {
  await connectToDatabase();
  const query: Record<string, unknown> = { ownerId };
  if (filters.type) query.type = filters.type;
  if (filters.difficulty) query.difficulty = filters.difficulty;

  let questions = await Question.find(query).sort({ createdAt: -1 }).lean();

  if (filters.usage) {
    const usedIds = await getUsedQuestionIdSet(ownerId);
    questions = questions.filter((q) =>
      filters.usage === "USED" ? usedIds.has(q._id.toString()) : !usedIds.has(q._id.toString())
    );
  }

  return questions.map(toQuestionRecord);
}

export async function getQuestionById(questionId: string, ownerId: string): Promise<QuestionRecord | null> {
  await connectToDatabase();
  const question = await Question.findOne({ _id: questionId, ownerId }).lean();
  if (!question) return null;
  return toQuestionRecord(question);
}

/** Resolves a round's `questions` id list into full `QuestionRecord`s, preserving array order. */
export async function getQuestionsByRoundId(roundId: string): Promise<QuestionRecord[]> {
  await connectToDatabase();
  const round = await Round.findById(roundId).select("questions").lean();
  if (!round || round.questions.length === 0) return [];

  const questions = await Question.find({ _id: { $in: round.questions } }).lean();
  const byId = new Map(questions.map((q) => [q._id.toString(), q]));
  return round.questions
    .map((id) => byId.get(id.toString()))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map(toQuestionRecord);
}

/** Every question across a room's selected rounds, flattened in round → question order, tagged with its round. */
export async function getQuestionsForRoomRounds(
  selectedRounds: string[]
): Promise<Array<QuestionRecord & { roundId: string }>> {
  if (selectedRounds.length === 0) return [];
  await connectToDatabase();

  const rounds = await Round.find({ _id: { $in: selectedRounds } }).select("questions").lean();
  const roundById = new Map(rounds.map((r) => [r._id.toString(), r]));

  const allQuestionIds = selectedRounds.flatMap((roundId) => roundById.get(roundId)?.questions ?? []);
  if (allQuestionIds.length === 0) return [];

  const questions = await Question.find({ _id: { $in: allQuestionIds } }).lean();
  const questionById = new Map(questions.map((q) => [q._id.toString(), q]));

  const result: Array<QuestionRecord & { roundId: string }> = [];
  for (const roundId of selectedRounds) {
    const round = roundById.get(roundId);
    if (!round) continue;
    for (const questionId of round.questions) {
      const question = questionById.get(questionId.toString());
      if (question) result.push({ ...toQuestionRecord(question), roundId });
    }
  }
  return result;
}
