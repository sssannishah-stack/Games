"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Question, Round, Scene } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertQuestionOwnership } from "@/lib/authz";
import { addQuestionsToRound } from "@/actions/round.actions";
import {
  createQuestionSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type UpdateQuestionInput,
} from "@/validators/question.validator";

function refreshQuestionPaths() {
  revalidatePath("/admin/questions");
}

export type CreateQuestionArgs = CreateQuestionInput & { attachToRoundIds?: string[] };

/** Create a reusable question in the host's library. Optionally attach it to one or more existing rounds. */
export async function createQuestion(input: CreateQuestionArgs): Promise<{ id: string }> {
  const user = await requireUser();
  const { attachToRoundIds, ...rest } = input;
  const data = createQuestionSchema.parse(rest);

  await connectToDatabase();
  const question = await Question.create({ ownerId: user.id, ...data });

  if (attachToRoundIds && attachToRoundIds.length > 0) {
    await Promise.all(
      attachToRoundIds.map((roundId) => addQuestionsToRound(roundId, [question._id.toString()]))
    );
  }

  refreshQuestionPaths();
  return { id: question._id.toString() };
}

export async function updateQuestion(questionId: string, input: UpdateQuestionInput): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);
  const data = updateQuestionSchema.parse(input);

  await connectToDatabase();
  await Question.findByIdAndUpdate(questionId, { $set: data });

  refreshQuestionPaths();
}

/** Duplicates a question as a fresh, standalone library item — not auto-attached to any round. */
export async function duplicateQuestion(questionId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const source = await assertQuestionOwnership(questionId, user.id);
  await connectToDatabase();

  const copy = await Question.create({
    ownerId: user.id,
    type: source.type,
    question: `${source.question} Copy`,
    mediaUrl: source.mediaUrl,
    media: source.media,
    isMCQ: source.isMCQ,
    options: source.options,
    answer: source.answer,
    explanation: source.explanation,
    hints: source.hints,
    hostNotes: source.hostNotes,
    scoringMode: source.scoringMode,
    timerMode: source.timerMode,
    timer: source.timer,
    positiveMarks: source.positiveMarks,
    negativeMarks: source.negativeMarks,
    bonusMarks: source.bonusMarks,
    coinReward: source.coinReward,
    difficulty: source.difficulty,
    tags: source.tags ?? [],
  });

  refreshQuestionPaths();
  return { id: copy._id.toString() };
}

/** Deletes a question from the library, detaching it from every round and clearing any scene that pointed at it. */
export async function deleteQuestion(questionId: string): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);

  await connectToDatabase();
  await Question.findByIdAndDelete(questionId);
  await Round.updateMany({ questions: questionId }, { $pull: { questions: questionId } });
  await Scene.updateMany({ questionId }, { $set: { questionId: null } });

  refreshQuestionPaths();
}

/** The Question Bank list's "Add to Round" row action — attaches an existing question to one or more rounds. */
export async function attachQuestionToRounds(questionId: string, roundIds: string[]): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);

  await Promise.all(roundIds.map((roundId) => addQuestionsToRound(roundId, [questionId])));
  refreshQuestionPaths();
}
