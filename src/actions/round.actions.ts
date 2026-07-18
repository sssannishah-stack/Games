"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Round, Question, Room } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoundOwnership } from "@/lib/authz";
import { applyQuestionTeamAssignments } from "@/actions/scene.actions";
import {
  createRoundSchema,
  updateRoundSchema,
  type CreateRoundInput,
  type UpdateRoundInput,
} from "@/validators/round.validator";

function refreshRoundPaths(roundId?: string) {
  revalidatePath("/admin/rounds");
  if (roundId) revalidatePath(`/admin/rounds/${roundId}`);
}

/** Create a reusable round in the host's library — not tied to any room. */
export async function createRound(input: CreateRoundInput): Promise<{ id: string }> {
  const user = await requireUser();
  const data = createRoundSchema.parse(input);

  await connectToDatabase();
  const round = await Round.create({ ownerId: user.id, ...data, questions: [] });

  refreshRoundPaths();
  return { id: round._id.toString() };
}

export async function updateRound(roundId: string, input: UpdateRoundInput): Promise<void> {
  const user = await requireUser();
  await assertRoundOwnership(roundId, user.id);
  const data = updateRoundSchema.parse(input);

  await connectToDatabase();
  await Round.findByIdAndUpdate(roundId, { $set: data });

  // Question→team assignment is derived from the round's questionAssignment
  // mode. If it changed, re-stamp every room running this round so a
  // Fixed/Random Team order actually shows up on the question scenes instead
  // of the host seeing no team.
  if (data.questionAssignment !== undefined) {
    const rooms = await Room.find({ selectedRounds: roundId }).select("_id competitionId").lean();
    await Promise.all(
      rooms.map((room) => applyQuestionTeamAssignments(room._id.toString(), room.competitionId))
    );
  }

  refreshRoundPaths(roundId);
}

/** Duplicates a round by reference — the copy points at the same library Questions, it doesn't clone them. */
export async function duplicateRound(roundId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const round = await assertRoundOwnership(roundId, user.id);
  await connectToDatabase();

  const copy = await Round.create({
    ownerId: user.id,
    title: `${round.title} Copy`,
    description: round.description,
    rules: round.rules,
    category: round.category ?? "Custom",
    roundType: round.roundType,
    questions: round.questions,
    scoringMode: round.scoringMode,
    defaultTimer: round.defaultTimer,
    positiveMarks: round.positiveMarks,
    negativeMarks: round.negativeMarks,
    bonusMarks: round.bonusMarks,
    coinReward: round.coinReward,
    questionAssignment: round.questionAssignment,
    powerCardMode: round.powerCardMode,
    allowedPowerCards: round.allowedPowerCards,
  });

  refreshRoundPaths();
  return { id: copy._id.toString() };
}

/** Deletes a round from the library. Questions are shared and survive; rooms that had selected this round drop the reference. */
export async function deleteRound(roundId: string): Promise<void> {
  const user = await requireUser();
  await assertRoundOwnership(roundId, user.id);

  await connectToDatabase();
  await Round.findByIdAndDelete(roundId);
  await Room.updateMany({ selectedRounds: roundId }, { $pull: { selectedRounds: roundId } });

  refreshRoundPaths();
}

/**
 * Create a fresh round and attach the given library questions to it in order —
 * the "turn a whole group into a round" shortcut. The questions stay shared
 * library items (referenced, not cloned), same as adding them by hand.
 */
export async function createRoundWithQuestions(
  title: string,
  questionIds: string[]
): Promise<{ id: string }> {
  const user = await requireUser();
  const clean = title.trim();
  if (!clean) throw new Error("Round title is required.");
  await connectToDatabase();

  // Preserve the caller's order, keep only this host's real questions.
  const owned = await Question.find({ _id: { $in: questionIds }, ownerId: user.id }).select("_id").lean();
  const ownedSet = new Set(owned.map((q) => q._id.toString()));
  const orderedIds = questionIds.filter((id) => ownedSet.has(id));

  const round = await Round.create({ ownerId: user.id, title: clean, questions: orderedIds });
  refreshRoundPaths();
  return { id: round._id.toString() };
}

/** Appends the given questions to a round's ordered list, skipping any already attached. */
export async function addQuestionsToRound(roundId: string, questionIds: string[]): Promise<void> {
  const user = await requireUser();
  const round = await assertRoundOwnership(roundId, user.id);
  await connectToDatabase();

  const valid = await Question.find({ _id: { $in: questionIds }, ownerId: user.id }).select("_id").lean();
  const existing = new Set(round.questions.map((id) => id.toString()));
  const toAdd = valid.map((q) => q._id).filter((id) => !existing.has(id.toString()));
  if (toAdd.length === 0) return;

  await Round.findByIdAndUpdate(roundId, { $push: { questions: { $each: toAdd } } });
  refreshRoundPaths(roundId);
}

export async function removeQuestionFromRound(roundId: string, questionId: string): Promise<void> {
  const user = await requireUser();
  await assertRoundOwnership(roundId, user.id);
  await connectToDatabase();

  await Round.findByIdAndUpdate(roundId, { $pull: { questions: questionId } });
  refreshRoundPaths(roundId);
}

/** Replaces a round's question order wholesale — the caller always sends the full ordered array. */
export async function reorderRoundQuestions(roundId: string, questionIds: string[]): Promise<void> {
  const user = await requireUser();
  const round = await assertRoundOwnership(roundId, user.id);
  await connectToDatabase();

  const current = new Set(round.questions.map((id) => id.toString()));
  const next = new Set(questionIds);
  const isSamePermutation = current.size === next.size && [...current].every((id) => next.has(id));
  if (!isSamePermutation) throw new Error("Question order must be a reordering of the round's existing questions.");

  await Round.findByIdAndUpdate(roundId, { $set: { questions: questionIds } });
  refreshRoundPaths(roundId);
}
